import { beforeEach, describe, expect, it, vi } from "vitest";

const { getVerifiedUser, insert, from } = vi.hoisted(() => {
  const insert = vi.fn();
  return { getVerifiedUser: vi.fn(), insert, from: vi.fn(() => ({ insert })) };
});
vi.mock("@/lib/supabase/user", () => ({ getVerifiedUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

import { POST } from "@/app/api/v2/feedback/route";

let ip = 0;
const post = (body: unknown, extra: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/v2/feedback", {
      method: "POST",
      headers: { "x-forwarded-for": `198.51.100.${++ip}`, ...extra },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getVerifiedUser.mockReset().mockResolvedValue(null);
  insert.mockReset().mockResolvedValue({ error: null });
  from.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/v2/feedback", () => {
  it("stores feedback without an identifier when there is no account", async () => {
    const res = await post({ foundGap: "yes", conceptId: "overfitting" });
    expect(res.status).toBe(204);
    expect(from).toHaveBeenCalledWith("feedback");
    expect(insert).toHaveBeenCalledWith({
      user_id: null,
      concept_id: "overfitting",
      found_gap: "yes",
      comment: null,
    });
  });

  it("attaches the verified user's id and scrubs personal details from the comment", async () => {
    getVerifiedUser.mockResolvedValue({ id: "u1" });
    const res = await post({ comment: "mail me at a@b.com or see https://x.io  please" });
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledWith({
      user_id: "u1",
      concept_id: null,
      found_gap: null,
      comment: "mail me at [email] or see [link] please",
    });
  });

  it.each([
    ["nothing at all", {}],
    ["a blank comment only", { comment: "   " }],
    ["an unknown answer", { foundGap: "maybe" }],
    ["an unknown concept", { foundGap: "yes", conceptId: "nope" }],
    ["an over-long comment", { comment: "x".repeat(1001) }],
  ])("rejects %s", async (_name, body) => {
    expect((await post(body)).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    expect((await post("not json")).status).toBe(400);
  });

  it("refuses a request from another origin", async () => {
    const res = await post({ foundGap: "yes" }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports a storage failure", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    expect((await post({ foundGap: "no" })).status).toBe(500);
  });
});

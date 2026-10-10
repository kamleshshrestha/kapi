import { beforeEach, describe, expect, it, vi } from "vitest";

const { getVerifiedUser, deleteUser } = vi.hoisted(() => ({
  getVerifiedUser: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/lib/supabase/user", () => ({ getVerifiedUser }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser } } }),
}));

import { DELETE } from "@/app/api/v2/account/route";
import { GET } from "@/app/api/v2/account/export/route";

let ip = 0;
const headers = () => ({ "x-forwarded-for": `203.0.113.${++ip}` });
const signOut = vi.fn().mockResolvedValue({});

function userWith(rows: Record<string, unknown[]>, failOn?: string) {
  return {
    id: "u1",
    supabase: {
      auth: { signOut },
      from: (table: string) => ({
        select: () =>
          Promise.resolve(
            table === failOn
              ? { data: null, error: { message: "x" } }
              : { data: rows[table] ?? [], error: null },
          ),
      }),
    },
  };
}

beforeEach(() => {
  getVerifiedUser.mockReset();
  deleteUser.mockReset();
  signOut.mockClear();
});

describe("DELETE /api/v2/account", () => {
  const del = (extra: Record<string, string> = {}) =>
    DELETE(new Request("http://localhost/api/v2/account", { method: "DELETE", headers: { ...headers(), ...extra } }));

  it("is 401 without a verified session and deletes nothing", async () => {
    getVerifiedUser.mockResolvedValue(null);
    expect((await del()).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses a request from another origin", async () => {
    getVerifiedUser.mockResolvedValue(userWith({}));
    expect((await del({ origin: "https://evil.example" })).status).toBe(403);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the verified user's account and ends their session", async () => {
    getVerifiedUser.mockResolvedValue(userWith({}));
    deleteUser.mockResolvedValue({ error: null });
    const res = await del({ origin: "http://localhost" });
    expect(res.status).toBe(204);
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(signOut).toHaveBeenCalled();
  });

  it("reports failure without signing out when deletion fails", async () => {
    getVerifiedUser.mockResolvedValue(userWith({}));
    deleteUser.mockResolvedValue({ error: { message: "boom" } });
    expect((await del()).status).toBe(500);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("GET /api/v2/account/export", () => {
  const get = () => GET(new Request("http://localhost/api/v2/account/export", { headers: headers() }));

  it("is 401 without a verified session", async () => {
    getVerifiedUser.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it("returns every table as a downloadable, uncached JSON file", async () => {
    getVerifiedUser.mockResolvedValue(userWith({ consents: [{ purpose: "product_improvement", granted: true }] }));
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.userId).toBe("u1");
    expect(Object.keys(body.data)).toEqual(["last_sessions", "personal_cards", "card_mastery", "consents", "session_events"]);
    expect(body.data.consents).toHaveLength(1);
  });

  it("fails rather than returning a partial export", async () => {
    getVerifiedUser.mockResolvedValue(userWith({}, "card_mastery"));
    expect((await get()).status).toBe(500);
  });
});

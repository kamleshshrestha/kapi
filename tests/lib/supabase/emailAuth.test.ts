import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

import {
  confirmLinkCode,
  confirmSignInCode,
  getAccountInfo,
  requestLinkCode,
  requestSignInCode,
  signOutHere,
} from "@/lib/supabase/emailAuth";

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
});

describe("getAccountInfo", () => {
  it("reports an anonymous user without an email", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "", is_anonymous: true } } });
    expect(await getAccountInfo()).toEqual({ userId: "u1", email: null, isAnonymous: true });
  });

  it("reports a confirmed email", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.example", is_anonymous: false } } });
    expect(await getAccountInfo()).toEqual({ userId: "u1", email: "a@b.example", isAnonymous: false });
  });

  it("reports no session, also when the call throws", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect((await getAccountInfo()).userId).toBeNull();
    auth.getUser.mockRejectedValue(new Error("offline"));
    expect(await getAccountInfo()).toEqual({ userId: null, email: null, isAnonymous: false });
  });
});

describe("linking an email to the anonymous account", () => {
  it("asks Supabase to attach the trimmed email to the current user", async () => {
    expect(await requestLinkCode("  me@example.com ")).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ email: "me@example.com" });
  });

  it("rejects a malformed address without calling Supabase", async () => {
    expect(await requestLinkCode("nope")).toEqual({ ok: false, reason: "invalid-email" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["email_exists", 422, "taken"],
    ["over_email_send_rate_limit", 429, "rate-limited"],
    ["email_address_invalid", 400, "invalid-email"],
    ["something_else", 500, "failed"],
  ])("maps %s to %s", async (code, status, reason) => {
    auth.updateUser.mockResolvedValue({ error: { code, status } });
    expect(await requestLinkCode("me@example.com")).toEqual({ ok: false, reason });
  });

  it("confirms with the email_change code type", async () => {
    expect(await confirmLinkCode("me@example.com", "123 456")).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "me@example.com", token: "123456", type: "email_change" });
  });
});

describe("signing in with a code", () => {
  it("requests a code without ever creating an account", async () => {
    await requestSignInCode("me@example.com");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "me@example.com",
      options: { shouldCreateUser: false },
    });
  });

  it("does not reveal whether the address has an account", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { code: "otp_disabled", status: 422 } });
    expect(await requestSignInCode("nobody@example.com")).toEqual({ ok: true });
  });

  it("still reports a rate limit", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } });
    expect(await requestSignInCode("me@example.com")).toEqual({ ok: false, reason: "rate-limited" });
  });

  it("confirms with the email code type", async () => {
    expect(await confirmSignInCode("me@example.com", "654321")).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "me@example.com", token: "654321", type: "email" });
  });
});

describe("code checking", () => {
  it.each(["", "12", "abcdef", "1234567890"])("rejects the code %j before calling Supabase", async (code) => {
    expect(await confirmSignInCode("me@example.com", code)).toEqual({ ok: false, reason: "bad-code" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("reports a wrong or expired code", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
    expect(await confirmSignInCode("me@example.com", "123456")).toEqual({ ok: false, reason: "bad-code" });
  });
});

describe("signOutHere", () => {
  it("ends only this browser's session, and never throws", async () => {
    await signOutHere();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    auth.signOut.mockRejectedValue(new Error("x"));
    await expect(signOutHere()).resolves.toBeUndefined();
  });
});

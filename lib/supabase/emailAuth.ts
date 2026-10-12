import { createClient } from "./client";

/**
 * Email on top of the anonymous account, always with a 6-digit code the
 * learner types in (never a link: links must be opened in the browser that
 * asked for them, which phone mail apps often don't do).
 * - link:    attach an email to the current anonymous account (same user id,
 *            so everything already saved stays attached)
 * - sign in: get into an existing account from another browser or device
 */
export type AuthFailure = "invalid-email" | "taken" | "rate-limited" | "bad-code" | "failed";
export type AuthResult = { ok: true } | { ok: false; reason: AuthFailure };

export type AccountInfo = {
  /** Null when there is no session at all. */
  userId: string | null;
  /** The confirmed email, once there is one. */
  email: string | null;
  isAnonymous: boolean;
};

const CODE = /^\d{6,8}$/;

type AuthError = { code?: string; status?: number } | null;

function failureFor(error: NonNullable<AuthError>): AuthFailure {
  if (error.code === "email_exists" || error.code === "identity_already_exists") return "taken";
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || error.status === 429) {
    return "rate-limited";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") return "invalid-email";
  return "failed";
}

function cleanEmail(email: string): string | null {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

export async function getAccountInfo(): Promise<AccountInfo> {
  try {
    const { data } = await createClient().auth.getUser();
    const user = data.user;
    if (!user) return { userId: null, email: null, isAnonymous: false };
    return { userId: user.id, email: user.email || null, isAnonymous: user.is_anonymous === true };
  } catch {
    return { userId: null, email: null, isAnonymous: false };
  }
}

/** Sends a code to attach this email to the current anonymous account. */
export async function requestLinkCode(email: string): Promise<AuthResult> {
  const clean = cleanEmail(email);
  if (!clean) return { ok: false, reason: "invalid-email" };
  try {
    const { error } = await createClient().auth.updateUser({ email: clean });
    return error ? { ok: false, reason: failureFor(error) } : { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function confirmLinkCode(email: string, code: string): Promise<AuthResult> {
  return verify(email, code, "email_change");
}

/**
 * Sends a sign-in code to an existing account. It never creates an account,
 * and it does not reveal whether the address has one: any failure other than
 * a rate limit looks like success.
 */
export async function requestSignInCode(email: string): Promise<AuthResult> {
  const clean = cleanEmail(email);
  if (!clean) return { ok: false, reason: "invalid-email" };
  try {
    const { error } = await createClient().auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: false },
    });
    if (error && failureFor(error) === "rate-limited") return { ok: false, reason: "rate-limited" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function confirmSignInCode(email: string, code: string): Promise<AuthResult> {
  return verify(email, code, "email");
}

async function verify(email: string, code: string, type: "email_change" | "email"): Promise<AuthResult> {
  const clean = cleanEmail(email);
  const token = code.replace(/\s/g, "");
  if (!clean) return { ok: false, reason: "invalid-email" };
  if (!CODE.test(token)) return { ok: false, reason: "bad-code" };
  try {
    const { error } = await createClient().auth.verifyOtp({ email: clean, token, type });
    if (!error) return { ok: true };
    return { ok: false, reason: failureFor(error) === "rate-limited" ? "rate-limited" : "bad-code" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Ends this browser's session only; the account and its data stay as they are. */
export async function signOutHere(): Promise<void> {
  try {
    await createClient().auth.signOut({ scope: "local" });
  } catch {
    // Nothing more to do; a stale local session is harmless.
  }
}

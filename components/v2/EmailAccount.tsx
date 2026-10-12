"use client";

import { useEffect, useState } from "react";
import {
  confirmLinkCode,
  confirmSignInCode,
  getAccountInfo,
  requestLinkCode,
  requestSignInCode,
  signOutHere,
  type AccountInfo,
  type AuthFailure,
  type AuthResult,
} from "@/lib/supabase/emailAuth";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isSyncEnabled, setSyncEnabled, SYNC_CHANGED_EVENT } from "@/lib/sync/enabled";

type Mode = "link" | "signin";
type Step = "email" | "code";

const MESSAGES: Record<AuthFailure, string> = {
  "invalid-email": "That doesn't look like an email address.",
  taken: "That email already has an account. Use \"Sign in with email\" instead.",
  "rate-limited": "Too many requests. Please wait a bit and try again.",
  "bad-code": "That code didn't work. Check it, or ask for a new one.",
  failed: "Something went wrong. Please try again.",
};

const linkButton =
  "py-2 -my-2 underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const field =
  "rounded-lg border border-foreground/10 bg-transparent px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const primary =
  "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Optional email for the learner's account, confirmed with a 6-digit code:
 * keep access to the saved progress, or sign in from another device. Nothing
 * here is needed to use Kapi.
 */
export default function EmailAccount() {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [syncOn, setSyncOn] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setSyncOn(isSyncEnabled());
    setInfo(await getAccountInfo());
  }

  useEffect(() => {
    if (!getSupabaseConfig()) return;
    // Reads the session and localStorage, unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    window.addEventListener(SYNC_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SYNC_CHANGED_EVENT, refresh);
  }, []);

  if (!getSupabaseConfig() || info === null) return null;

  function open(next: Mode) {
    setMode(next);
    setStep("email");
    setCode("");
    setError(null);
    setNotice(null);
  }

  function close() {
    setMode(null);
    setStep("email");
    setCode("");
    setError(null);
  }

  async function run(action: () => Promise<AuthResult>, onOk: () => void | Promise<void>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) await onOk();
    else setError(MESSAGES[result.reason]);
  }

  function sendCode() {
    const request = mode === "link" ? requestLinkCode : requestSignInCode;
    void run(() => request(email), () => setStep("code"));
  }

  function confirmCode() {
    const confirm = mode === "link" ? confirmLinkCode : confirmSignInCode;
    void run(
      () => confirm(email, code),
      async () => {
        const wasLink = mode === "link";
        close();
        setNotice(
          wasLink
            ? "Email saved. You can now sign in with it on another device."
            : "Signed in. Your saved progress is being loaded.",
        );
        // Signing in means they want their account's progress here.
        if (!wasLink) setSyncEnabled(true);
        await refresh();
      },
    );
  }

  async function signOut() {
    await signOutHere();
    setSyncEnabled(false);
    setNotice("Signed out on this device. Your account and saved progress are unchanged.");
    await refresh();
  }

  return (
    <div className="flex flex-col gap-3 text-sm text-foreground/60">
      {mode === null && info.email && (
        <p>
          Signed in as {info.email}.{" "}
          <button type="button" className={linkButton} onClick={() => void signOut()}>
            Sign out
          </button>
        </p>
      )}
      {mode === null && !info.email && (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {syncOn && info.isAnonymous && (
            <button type="button" className={linkButton} onClick={() => open("link")}>
              Keep access with your email
            </button>
          )}
          <button type="button" className={linkButton} onClick={() => open("signin")}>
            Sign in with email
          </button>
        </p>
      )}

      {mode !== null && (
        <form
          aria-label={mode === "link" ? "Keep access with your email" : "Sign in with email"}
          className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4 text-foreground"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            if (step === "email") sendCode();
            else confirmCode();
          }}
        >
          <p className="font-medium">
            {mode === "link" ? "Keep access with your email" : "Sign in with email"}
          </p>
          <p className="text-sm text-foreground/70">
            {mode === "link"
              ? "We'll email you a 6-digit code. Your email is used only for signing in, so you can reach your saved progress from another device."
              : "We'll email you a 6-digit code to get into the account you saved earlier."}
          </p>
          {step === "email" ? (
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              Code from the email sent to {email.trim()}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={field}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={primary}>
              {step === "email" ? "Send code" : mode === "link" ? "Save email" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-foreground/10 px-4 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {notice && (
        <p role="status" className="text-foreground/70">
          {notice}
        </p>
      )}
    </div>
  );
}

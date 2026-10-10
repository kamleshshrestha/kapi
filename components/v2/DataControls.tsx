"use client";

import { useEffect, useState } from "react";
import { hasConsent, recordConsent } from "@/lib/privacy/consent";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { isSyncEnabled, setSyncEnabled } from "@/lib/sync/enabled";

type View = "loading" | "local-only" | "account" | "deleted";

const button =
  "rounded-full border border-foreground/10 px-4 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * The learner's controls over what is stored about them: the opt-in for
 * product-improvement logging, a JSON export and account deletion. Only
 * relevant once they have turned on account sync.
 */
export default function DataControls() {
  const [view, setView] = useState<View>("loading");
  const [improve, setImprove] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getSupabaseConfig() || !isSyncEnabled()) {
        setView("local-only");
        return;
      }
      const granted = await hasConsent("product_improvement");
      if (cancelled) return;
      setImprove(granted);
      setView("account");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleImprove(next: boolean) {
    setImprove(next);
    const ok = await recordConsent("product_improvement", next);
    if (!ok) {
      setImprove(!next);
      setMessage("Could not save that choice. Please try again.");
    } else {
      setMessage(null);
    }
  }

  async function download() {
    setMessage(null);
    const res = await fetch("/api/v2/account/export");
    if (!res.ok) {
      setMessage("Could not export your data. Please try again.");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "kapi-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    setMessage(null);
    const res = await fetch("/api/v2/account", { method: "DELETE" });
    if (!res.ok) {
      setMessage("Could not delete your account. Please try again.");
      setConfirming(false);
      return;
    }
    setSyncEnabled(false);
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // The account is already gone; a stale local session is harmless.
    }
    setView("deleted");
  }

  if (view === "loading") return null;

  if (view === "deleted") {
    return (
      <p role="status" className="text-sm">
        Your account and everything saved on it has been deleted. Progress kept in
        this browser is not affected.
      </p>
    );
  }

  if (view === "local-only") {
    return (
      <p className="text-sm text-foreground/70">
        Nothing about you is stored on an account. Your progress is kept only in
        this browser.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          className="mt-1.5"
          checked={improve}
          onChange={(e) => void toggleImprove(e.target.checked)}
        />
        <span>
          Help improve Kapi: let Kapi keep which gap was found, how each question
          went and a short excerpt of what I wrote (with emails, links and
          numbers removed). Off unless I turn it on, and I can turn it off at
          any time.
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={button} onClick={() => void download()}>
          Download my data
        </button>
        {!confirming && (
          <button type="button" className={button} onClick={() => setConfirming(true)}>
            Delete my account and its data
          </button>
        )}
      </div>

      {confirming && (
        <div role="alertdialog" aria-label="Confirm deletion" className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
          <p className="text-sm">
            This permanently deletes your account and everything saved on it.
            Progress kept in this browser is not affected.
          </p>
          <div className="flex gap-3">
            <button type="button" className={button} onClick={() => void deleteAccount()}>
              Yes, delete everything
            </button>
            <button type="button" className={button} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="text-sm text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}

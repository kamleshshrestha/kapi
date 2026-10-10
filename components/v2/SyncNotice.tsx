"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  dismissSyncNotice,
  isSyncEnabled,
  isSyncNoticeDismissed,
  setSyncEnabled,
} from "@/lib/sync/enabled";

type State = "hidden" | "ask" | "on" | "off";

/**
 * Asks before anything is stored on an account. Shown on the home page; the
 * learner's answer is remembered in this browser. Never shown when Supabase
 * isn't configured.
 */
export default function SyncNotice() {
  const [state, setState] = useState<State>("hidden");

  useEffect(() => {
    // Reads localStorage, unavailable during SSR — can't run during render.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!getSupabaseConfig()) return;
    if (isSyncEnabled()) setState("on");
    else if (isSyncNoticeDismissed()) setState("off");
    else setState("ask");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (state === "hidden") return null;

  if (state === "on") {
    return (
      <p className="text-sm text-foreground/60">
        Your progress is saved to an account tied to this browser.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Your data
        </Link>{" "}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => {
            setSyncEnabled(false);
            setState("off");
          }}
        >
          Turn off
        </button>
      </p>
    );
  }

  if (state === "off") {
    return (
      <p className="text-sm text-foreground/60">
        Progress stays in this browser only.{" "}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => {
            setSyncEnabled(true);
            setState("on");
          }}
        >
          Save it to an account
        </button>
      </p>
    );
  }

  return (
    <section
      aria-labelledby="sync-notice-title"
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-5"
    >
      <h2 id="sync-notice-title" className="font-medium">
        Keep your progress safe?
      </h2>
      <p className="text-sm leading-6 text-foreground/70">
        Kapi can save your flashcards, your card ratings and the gap you last
        worked on to an anonymous account tied to this browser, so they are not
        lost if you clear your browsing data. No email or name is needed, and
        your own chat messages are not saved. You can turn this off at any time.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy details
        </Link>
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => {
            setSyncEnabled(true);
            setState("on");
          }}
        >
          Save my progress
        </button>
        <button
          type="button"
          className="rounded-full border border-foreground/10 px-4 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => {
            dismissSyncNotice();
            setState("off");
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}

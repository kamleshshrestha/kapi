"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { ensureAnonymousSession } from "@/lib/supabase/session";
import { SYNC_CHANGED_EVENT, isSyncEnabled } from "@/lib/sync/enabled";
import { hydrate, startPushing } from "@/lib/sync/sync";

/**
 * Renders nothing. While the learner has sync turned on, merges their account
 * with this browser at startup and mirrors later changes. Any failure leaves
 * the app working from localStorage alone.
 */
export default function SyncRunner() {
  useEffect(() => {
    if (!getSupabaseConfig()) return;

    let stop: (() => void) | null = null;
    let run = 0;

    async function start() {
      const mine = ++run;
      stop?.();
      stop = null;
      if (!isSyncEnabled()) return;

      const userId = await ensureAnonymousSession();
      if (!userId || mine !== run) return;

      const db = createClient();
      try {
        await hydrate(db, userId);
      } catch {
        // Offline or the account is unreachable: keep going locally.
      }
      if (mine !== run) return;
      stop = startPushing(db, userId);
    }

    void start();
    window.addEventListener(SYNC_CHANGED_EVENT, start);
    return () => {
      run++;
      window.removeEventListener(SYNC_CHANGED_EVENT, start);
      stop?.();
    };
  }, []);

  return null;
}

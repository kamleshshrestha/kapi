import { emitLocalChange } from "./changeEvents";

/**
 * Remembers the outcome of the last chat session per concept, so a returning
 * learner gets a "welcome back" opener instead of starting cold. Kept in
 * localStorage; if the learner turns on account sync (lib/sync/) it is also
 * mirrored to their account, otherwise it stays per-browser.
 */
export type LastSessionOutcome = {
  misconceptionId: string;
  misconceptionTitle: string;
  resolved: boolean;
  at: string;
};

const KEY_PREFIX = "kapi:v2:last-session:";

export function readLastSession(conceptId: string): LastSessionOutcome | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + conceptId);
    return raw ? (JSON.parse(raw) as LastSessionOutcome) : null;
  } catch {
    return null;
  }
}

/** Stores an outcome from the account without announcing it as a local change. */
export function applyRemoteLastSession(
  conceptId: string,
  outcome: LastSessionOutcome,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + conceptId, JSON.stringify(outcome));
  } catch {
    // Private browsing, quota exceeded, etc. — best effort only.
  }
}

export function writeLastSession(
  conceptId: string,
  outcome: LastSessionOutcome,
): void {
  applyRemoteLastSession(conceptId, outcome);
  emitLocalChange({ type: "last-session", conceptId, outcome });
}

/**
 * Remembers the outcome of the last chat session per concept, so a returning
 * learner gets a "welcome back" opener instead of starting cold. There is no
 * accounts system yet, so this is per-browser (localStorage), not per-person:
 * it will not follow a learner across devices.
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

export function writeLastSession(
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

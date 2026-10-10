/**
 * Whether the learner has turned on account sync. Off by default: nothing is
 * sent to the account (and no account is created) until they say yes.
 */
const ENABLED_KEY = "kapi:v2:sync-enabled";
const DISMISSED_KEY = "kapi:v2:sync-dismissed";

/** Fired on window whenever sync is turned on or off. */
export const SYNC_CHANGED_EVENT = "kapi:v2:sync-changed";
/** Fired on window after remote state has been merged into localStorage. */
export const SYNCED_EVENT = "kapi:v2:synced";

function read(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // Private browsing, quota exceeded, etc. — best effort only.
  }
}

export function isSyncEnabled(): boolean {
  return read(ENABLED_KEY);
}

export function setSyncEnabled(enabled: boolean): void {
  write(ENABLED_KEY, enabled);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_CHANGED_EVENT));
  }
}

export function isSyncNoticeDismissed(): boolean {
  return read(DISMISSED_KEY);
}

export function dismissSyncNotice(): void {
  write(DISMISSED_KEY, true);
}

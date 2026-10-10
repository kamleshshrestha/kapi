import { createClient } from "@/lib/supabase/client";

/** Bump when the privacy notice changes in a way that needs fresh consent. */
export const POLICY_VERSION = "2026-10-draft-1";

export type ConsentPurpose = "product_improvement";

/**
 * Whether the learner has currently agreed to `purpose`: the newest consent
 * row decides, and no row means no. Fails closed (false) on any error.
 */
export async function hasConsent(purpose: ConsentPurpose): Promise<boolean> {
  try {
    const { data, error } = await createClient()
      .from("consents")
      .select("granted")
      .eq("purpose", purpose)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return false;
    return data?.[0]?.granted === true;
  } catch {
    return false;
  }
}

/** Appends a consent record (grant or withdrawal). Returns false on failure. */
export async function recordConsent(
  purpose: ConsentPurpose,
  granted: boolean,
): Promise<boolean> {
  try {
    const { error } = await createClient()
      .from("consents")
      .insert({ purpose, granted, policy_version: POLICY_VERSION });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Deletes every log row kept about this learner. Used when they withdraw
 * consent, so withdrawing also removes what was already collected.
 */
export async function eraseLog(): Promise<boolean> {
  try {
    const { error } = await createClient()
      .from("session_events")
      .delete()
      .gte("created_at", "1970-01-01");
    return !error;
  } catch {
    return false;
  }
}

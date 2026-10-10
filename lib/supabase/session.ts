import { createClient } from "./client";

/**
 * Returns the current learner's id, signing in anonymously first if there is
 * no session. Call this only once the learner has been told that progress is
 * stored (never on page load), and treat a null result as "stay local-only":
 * the app must keep working without an account.
 */
export async function ensureAnonymousSession(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: existing } = await supabase.auth.getUser();
    if (existing.user) return existing.user.id;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

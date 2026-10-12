import { createClient } from "./server";

/**
 * The signed-in learner for this request, from a token Supabase has verified
 * (never from the raw cookie). Null when there is none or Supabase is not
 * configured. Returns the request-bound client so routes can reuse it, and the
 * account's email when it has one.
 */
export async function getVerifiedUser() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const id = data?.claims?.sub;
    if (error || !id) return null;
    const email = data?.claims?.email;
    return { id, email: typeof email === "string" && email ? email : null, supabase };
  } catch {
    return null;
  }
}

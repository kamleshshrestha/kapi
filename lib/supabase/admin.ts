import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/**
 * Supabase client with the secret key, which bypasses RLS. Server only, and
 * only for what a learner cannot do for themselves: writing the opt-in log
 * (after checking their consent) and deleting their account. Never import
 * this from a component or hook.
 */
export function createAdminClient() {
  const config = getSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secretKey) {
    throw new Error("Supabase admin access is not configured");
  }
  return createClient(config.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

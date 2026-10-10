import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./config";

/** Supabase client for Client Components. It is a singleton in the browser. */
export function createClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}

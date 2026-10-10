import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./config";

/**
 * Supabase client for Server Components and route handlers, acting as the
 * signed-in learner (RLS applies). Create one per request: it is bound to
 * that request's cookies.
 */
export async function createClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, which cannot write cookies. The
          // proxy refreshes the session on every request, so this is safe.
        }
      },
    },
  });
}

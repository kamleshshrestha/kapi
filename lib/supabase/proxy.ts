import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

/**
 * Refreshes the learner's Supabase session on each request and passes the
 * refreshed cookies on to Server Components (request) and the browser
 * (response). It never signs anyone in: anonymous sign-in happens in the
 * browser, after the learner has been told what is stored.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const config = getSupabaseConfig();
  if (!config) return supabaseResponse; // the app still works without accounts

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        // Keep CDNs from caching a response that carries a session cookie.
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // Verifies the token and refreshes it if needed. Do not use getSession()
  // on the server: it trusts the cookie without checking it.
  await supabase.auth.getClaims();

  return supabaseResponse;
}

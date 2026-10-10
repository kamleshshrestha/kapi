/**
 * Public Supabase settings. The NEXT_PUBLIC_ names must be referenced
 * literally so Next.js inlines them into the browser bundle.
 */
export function getSupabaseConfig(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

export function requireSupabaseConfig(): { url: string; publishableKey: string } {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured");
  }
  return config;
}

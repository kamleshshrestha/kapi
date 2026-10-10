import { checkRateLimit } from "@/lib/llm/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedUser } from "@/lib/supabase/user";

/** True when a browser sent this request from another origin. */
function isCrossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && new URL(origin).host !== new URL(request.url).host;
}

/**
 * GDPR erasure: deletes the signed-in learner's account. Every table
 * references auth.users with ON DELETE CASCADE, so their cards, ratings,
 * consents and log rows go with it.
 */
export async function DELETE(request: Request) {
  const limited = checkRateLimit(request);
  if (limited) return limited;
  if (isCrossSite(request)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const user = await getVerifiedUser();
  if (!user) {
    return Response.json({ error: "No account to delete." }, { status: 401 });
  }

  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch {
    return Response.json({ error: "Could not delete your account." }, { status: 500 });
  }

  // Deleting a user does not invalidate the token already in their cookie,
  // so end this session too.
  await user.supabase.auth.signOut().catch(() => {});

  return new Response(null, { status: 204 });
}

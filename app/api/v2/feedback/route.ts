import { getConcept } from "@/lib/learning/concepts";
import { checkRateLimit } from "@/lib/llm/rate-limit";
import { feedbackRequestSchema } from "@/lib/llm/schemas";
import { toExcerpt } from "@/lib/privacy/pii";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedUser } from "@/lib/supabase/user";

/** True when a browser sent this request from another origin. */
function isCrossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && new URL(origin).host !== new URL(request.url).host;
}

/**
 * Stores a learner's feedback. It is something they chose to send, so it
 * needs no consent toggle; it is attached to their account when they have one
 * (so export and deletion cover it) and otherwise carries no identifier.
 * The text is scrubbed of emails, links and long numbers before storing.
 */
export async function POST(request: Request) {
  const limited = await checkRateLimit(request);
  if (limited) return limited;
  if (isCrossSite(request)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = feedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { foundGap, conceptId } = parsed.data;
  if (conceptId !== undefined && !getConcept(conceptId)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const comment = parsed.data.comment ? toExcerpt(parsed.data.comment, 1000) : "";
  if (foundGap === undefined && comment === "") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const user = await getVerifiedUser();
    const { error } = await createAdminClient()
      .from("feedback")
      .insert({
        user_id: user?.id ?? null,
        concept_id: conceptId ?? null,
        found_gap: foundGap ?? null,
        comment: comment || null,
      });
    if (error) throw error;
  } catch (error) {
    console.error("[feedback] could not save", error);
    return Response.json({ error: "Could not save your feedback." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}

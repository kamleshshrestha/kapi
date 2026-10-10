import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedUser } from "@/lib/supabase/user";
import { toExcerpt } from "./pii";

export type ChatEvent = {
  /** Groups the events of one chat session; without it nothing is logged. */
  sessionId: string | undefined;
  conceptId: string;
  /** 0 for the diagnosis, then the number of the question answered. */
  turn: number;
  misconceptionId: string | null;
  result: "diagnosed" | "correct" | "hinted" | "revealed";
  /** What the learner wrote; scrubbed and cut to a short excerpt before storing. */
  learnerText: string;
};

/**
 * Records one chat event for the opt-in misconception log, after the response
 * has been sent. Nothing is stored unless the learner has an account and their
 * newest product_improvement consent is "granted". Never throws and never
 * delays the reply: a failure is only logged on the server.
 */
export function logChatEvent(event: ChatEvent): void {
  if (!event.sessionId) return;
  try {
    after(() => write(event));
  } catch {
    // Called outside a request (for example in a unit test): skip.
  }
}

async function write(event: ChatEvent): Promise<void> {
  try {
    const user = await getVerifiedUser();
    if (!user) return;

    // The newest consent row decides; no row, or any error, means no.
    const { data, error } = await user.supabase
      .from("consents")
      .select("granted")
      .eq("purpose", "product_improvement")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || data?.[0]?.granted !== true) return;

    const { error: insertError } = await createAdminClient()
      .from("session_events")
      .insert({
        user_id: user.id,
        session_id: event.sessionId,
        concept_id: event.conceptId,
        turn: event.turn,
        misconception_id: event.misconceptionId,
        result: event.result,
        excerpt: toExcerpt(event.learnerText),
      });
    if (insertError) throw insertError;
  } catch (error) {
    console.error("[log] could not record chat event", error);
  }
}

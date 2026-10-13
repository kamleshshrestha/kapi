import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What the server counts. Each is a daily total (see analytics_daily), never
 * tied to a person: no user id, session id or address is passed or stored.
 * - chat_started: a first explanation was diagnosed.
 * - chat_finished: the recap was produced at the end of a chat.
 * - teach_started / teach_finished: teach-it-back first and last message
 *   (detail = the verdict on the last one).
 * - rate_limited: a request was refused by the limiter (counted in batches, see countFloodEvent).
 * - model_error: the AI call failed (detail = the HTTP status we returned).
 */
export type AnalyticsEvent =
  | "chat_started"
  | "chat_finished"
  | "teach_started"
  | "teach_finished"
  | "rate_limited"
  | "model_error";

/**
 * Adds one to today's counter for this event, after the response has been
 * sent. Pass only values the server chose itself (a catalog concept id, a
 * verdict, a status code), never learner text. Never throws and never delays
 * the reply; if Supabase is not configured or the write fails, the count is
 * skipped and the failure is only logged.
 */
export function countEvent(event: AnalyticsEvent, opts: { concept?: string; detail?: string } = {}): void {
  try {
    after(() => write(event, opts.concept ?? "", opts.detail ?? "", 1));
  } catch {
    // Called outside a request (for example in a unit test): skip.
  }
}

const FLOOD_INTERVAL_MS = 10_000;
let floodSince = 0;
let floodPending = 0;

/**
 * Like countEvent for events that can arrive in floods (refused requests):
 * the database is written at most once per interval per server instance, with
 * the number counted since, so abuse cannot turn into a stream of writes. A
 * count still pending when the instance goes away is lost (it undercounts).
 */
export function countFloodEvent(event: AnalyticsEvent, now = Date.now()): void {
  floodPending += 1;
  if (now - floodSince < FLOOD_INTERVAL_MS) return;
  floodSince = now;
  const amount = floodPending;
  floodPending = 0;
  try {
    after(() => write(event, "", "", amount));
  } catch {
    // Outside a request: skip.
  }
}

async function write(event: AnalyticsEvent, concept: string, detail: string, amount: number): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("count_event", {
      p_event: event,
      p_concept: concept,
      p_detail: detail,
      p_count: amount,
    });
    if (error) throw error;
  } catch (error) {
    console.error("[analytics] could not count event", error);
  }
}

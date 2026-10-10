import type { SupabaseClient } from "@supabase/supabase-js";
import type { LastSessionOutcome } from "@/lib/learning/v2/localSession";
import type { PersonalCard } from "@/lib/learning/v2/personalCards";
import type {
  MasteryMap,
  MasteryRating,
} from "@/lib/learning/v2/flashcardMastery";

/** Reads and writes the learner's rows. RLS limits every call to their own. */
export type RemoteState = {
  lastSessions: Record<string, LastSessionOutcome>;
  cards: Record<string, PersonalCard[]>;
  mastery: Record<string, MasteryMap>;
};

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function pushLastSession(
  db: SupabaseClient,
  userId: string,
  conceptId: string,
  outcome: LastSessionOutcome,
): Promise<void> {
  const { error } = await db.from("last_sessions").upsert(
    {
      user_id: userId,
      concept_id: conceptId,
      misconception_id: outcome.misconceptionId,
      misconception_title: outcome.misconceptionTitle,
      resolved: outcome.resolved,
      at: outcome.at,
    },
    { onConflict: "user_id,concept_id" },
  );
  check(error, "last_sessions upsert");
}

/** Makes the account's cards for a concept match `cards` exactly. */
export async function replaceCards(
  db: SupabaseClient,
  userId: string,
  conceptId: string,
  cards: PersonalCard[],
): Promise<void> {
  if (cards.length > 0) {
    const { error } = await db.from("personal_cards").upsert(
      cards.map((c) => ({
        user_id: userId,
        id: c.id,
        concept_id: conceptId,
        misconception_id: c.misconceptionId,
        front: c.front,
        back: c.back,
        resolved_at: c.resolvedAt,
        kind: c.kind ?? "resolved",
      })),
      { onConflict: "user_id,id" },
    );
    check(error, "personal_cards upsert");
  }

  const { data, error: listError } = await db
    .from("personal_cards")
    .select("id")
    .eq("concept_id", conceptId);
  check(listError, "personal_cards list");

  const keep = new Set(cards.map((c) => c.id));
  const stale = (data ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (stale.length > 0) {
    const { error } = await db
      .from("personal_cards")
      .delete()
      .eq("concept_id", conceptId)
      .in("id", stale);
    check(error, "personal_cards delete");
  }
}

export async function pushMastery(
  db: SupabaseClient,
  userId: string,
  conceptId: string,
  ratings: Record<string, MasteryRating>,
): Promise<void> {
  const rows = Object.entries(ratings).map(([cardId, rating]) => ({
    user_id: userId,
    concept_id: conceptId,
    card_id: cardId,
    rating,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await db
    .from("card_mastery")
    .upsert(rows, { onConflict: "user_id,concept_id,card_id" });
  check(error, "card_mastery upsert");
}

export async function pullAll(db: SupabaseClient): Promise<RemoteState> {
  const [sessions, cards, mastery] = await Promise.all([
    db.from("last_sessions").select("*"),
    db.from("personal_cards").select("*"),
    db.from("card_mastery").select("*"),
  ]);
  check(sessions.error, "last_sessions select");
  check(cards.error, "personal_cards select");
  check(mastery.error, "card_mastery select");

  const state: RemoteState = { lastSessions: {}, cards: {}, mastery: {} };
  for (const r of sessions.data ?? []) {
    state.lastSessions[r.concept_id] = {
      misconceptionId: r.misconception_id,
      misconceptionTitle: r.misconception_title,
      resolved: r.resolved,
      at: new Date(r.at).toISOString(),
    };
  }
  for (const r of cards.data ?? []) {
    (state.cards[r.concept_id] ??= []).push({
      id: r.id,
      misconceptionId: r.misconception_id,
      front: r.front,
      back: r.back,
      resolvedAt: new Date(r.resolved_at).toISOString(),
      kind: r.kind,
    });
  }
  for (const r of mastery.data ?? []) {
    (state.mastery[r.concept_id] ??= {})[r.card_id] = r.rating;
  }
  return state;
}

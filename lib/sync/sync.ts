import type { SupabaseClient } from "@supabase/supabase-js";
import { concepts } from "@/lib/learning/concepts";
import { onLocalChange } from "@/lib/learning/v2/changeEvents";
import {
  readLastSession,
  applyRemoteLastSession,
} from "@/lib/learning/v2/localSession";
import {
  readPersonalCards,
  applyRemotePersonalCards,
} from "@/lib/learning/v2/personalCards";
import {
  readMastery,
  applyRemoteMastery,
} from "@/lib/learning/v2/flashcardMastery";
import { SYNCED_EVENT } from "./enabled";
import {
  mergeCards,
  mergeLastSession,
  mergeMastery,
  sameCards,
  sameMastery,
} from "./merge";
import { pullAll, pushLastSession, pushMastery, replaceCards } from "./remote";

/**
 * Merges the account's state with this browser's, writes the result locally
 * and pushes whatever the account was missing. This is also how existing
 * localStorage data reaches the account the first time sync is turned on.
 */
export async function hydrate(db: SupabaseClient, userId: string): Promise<void> {
  const remote = await pullAll(db);

  for (const { id: conceptId } of concepts) {
    const localSession = readLastSession(conceptId);
    const remoteSession = remote.lastSessions[conceptId] ?? null;
    const session = mergeLastSession(localSession, remoteSession);
    if (session) {
      if (session !== localSession) applyRemoteLastSession(conceptId, session);
      if (session !== remoteSession) {
        await pushLastSession(db, userId, conceptId, session);
      }
    }

    const localCards = readPersonalCards(conceptId);
    const remoteCards = remote.cards[conceptId] ?? [];
    const cards = mergeCards(localCards, remoteCards);
    if (!sameCards(cards, localCards)) applyRemotePersonalCards(conceptId, cards);
    if (!sameCards(cards, remoteCards)) {
      await replaceCards(db, userId, conceptId, cards);
    }

    const localMastery = readMastery(conceptId);
    const remoteMastery = remote.mastery[conceptId] ?? {};
    const mastery = mergeMastery(localMastery, remoteMastery);
    if (!sameMastery(mastery, localMastery)) applyRemoteMastery(conceptId, mastery);
    if (!sameMastery(mastery, remoteMastery)) {
      await pushMastery(db, userId, conceptId, mastery);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNCED_EVENT));
  }
}

/**
 * Mirrors each local change to the account in the background. A failed push
 * is dropped: the next hydrate() pushes anything the account is missing.
 * Returns an unsubscribe function.
 */
export function startPushing(db: SupabaseClient, userId: string): () => void {
  return onLocalChange((change) => {
    const push = (() => {
      switch (change.type) {
        case "last-session":
          return pushLastSession(db, userId, change.conceptId, change.outcome);
        case "personal-cards":
          return replaceCards(db, userId, change.conceptId, change.cards);
        case "mastery":
          return pushMastery(db, userId, change.conceptId, {
            [change.cardId]: change.rating,
          });
      }
    })();
    push.catch(() => {});
  });
}

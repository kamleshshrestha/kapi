import type { LastSessionOutcome } from "@/lib/learning/v2/localSession";
import {
  MAX_REVISIT_CARDS,
  type PersonalCard,
} from "@/lib/learning/v2/personalCards";
import type { MasteryMap } from "@/lib/learning/v2/flashcardMastery";

/** The newer of two outcomes (by `at`); a missing one loses. */
export function mergeLastSession(
  local: LastSessionOutcome | null,
  remote: LastSessionOutcome | null,
): LastSessionOutcome | null {
  if (!local) return remote;
  if (!remote) return local;
  return new Date(remote.at).getTime() > new Date(local.at).getTime()
    ? remote
    : local;
}

/**
 * Union of both decks by card id; when both have a card, the later one wins.
 * Revisit cards stay capped, dropping the oldest. Local order is kept, with
 * remote-only cards appended.
 */
export function mergeCards(
  local: PersonalCard[],
  remote: PersonalCard[],
): PersonalCard[] {
  const byId = new Map<string, PersonalCard>();
  for (const card of local) byId.set(card.id, card);
  for (const card of remote) {
    const mine = byId.get(card.id);
    if (!mine || new Date(card.resolvedAt) > new Date(mine.resolvedAt)) {
      byId.set(card.id, card);
    }
  }
  const all = [...byId.values()];
  const revisit = all
    .filter((c) => c.kind === "revisit")
    .sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt))
    .slice(-MAX_REVISIT_CARDS);
  const keptRevisit = new Set(revisit.map((c) => c.id));
  return all.filter((c) => c.kind !== "revisit" || keptRevisit.has(c.id));
}

/**
 * Ratings carry no timestamp locally, so on a clash the account's rating wins
 * (every local rating is pushed as it is made, so the account is normally current).
 */
export function mergeMastery(local: MasteryMap, remote: MasteryMap): MasteryMap {
  return { ...local, ...remote };
}

export function sameCards(a: PersonalCard[], b: PersonalCard[]): boolean {
  if (a.length !== b.length) return false;
  const bById = new Map(b.map((c) => [c.id, c]));
  return a.every((c) => {
    const other = bById.get(c.id);
    return (
      !!other &&
      other.front === c.front &&
      other.back === c.back &&
      other.resolvedAt === c.resolvedAt &&
      other.misconceptionId === c.misconceptionId &&
      (other.kind ?? "resolved") === (c.kind ?? "resolved")
    );
  });
}

export function sameMastery(a: MasteryMap, b: MasteryMap): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

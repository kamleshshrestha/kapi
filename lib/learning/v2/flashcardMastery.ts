import { emitLocalChange } from "./changeEvents";

/**
 * Per-card self-rating for flashcard review, kept in localStorage like the
 * rest of v2's session memory — per-browser, not per-person (no accounts
 * yet). No spaced-repetition scheduling: just the last rating per card.
 */
export type MasteryRating = "forgot" | "fuzzy" | "got-it";
export type MasteryMap = Record<string, MasteryRating>;

const KEY_PREFIX = "kapi:v2:mastery:";

export function readMastery(conceptId: string): MasteryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + conceptId);
    return raw ? (JSON.parse(raw) as MasteryMap) : {};
  } catch {
    return {};
  }
}

/** Stores ratings from the account without announcing them as a local change. */
export function applyRemoteMastery(conceptId: string, map: MasteryMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + conceptId, JSON.stringify(map));
  } catch {
    // Private browsing, quota exceeded, etc. — best effort only.
  }
}

/** Writes one card's rating and returns the updated map. */
export function writeMastery(
  conceptId: string,
  cardId: string,
  rating: MasteryRating,
): MasteryMap {
  const next = { ...readMastery(conceptId), [cardId]: rating };
  applyRemoteMastery(conceptId, next);
  emitLocalChange({ type: "mastery", conceptId, cardId, rating });
  return next;
}

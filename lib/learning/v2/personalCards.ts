/**
 * Personalized flashcards, created the moment a misconception resolves in a
 * chat session (see useV2ChatSession) and shown as the "From you" deck
 * alongside the catalog-derived "Core" deck. Unlike Core cards, front/back
 * are the actual probe question and resolved feedback from that session, so
 * the answer is in the learner's own resolved language, not a generic
 * restatement. Kept in localStorage like the rest of v2's session memory —
 * per-browser, not per-person.
 */
export type PersonalCard = {
  id: string;
  misconceptionId: string;
  front: string;
  back: string;
  resolvedAt: string;
};

const KEY_PREFIX = "kapi:v2:personal-cards:";

export function readPersonalCards(conceptId: string): PersonalCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + conceptId);
    return raw ? (JSON.parse(raw) as PersonalCard[]) : [];
  } catch {
    return [];
  }
}

/**
 * Adds or replaces the card for a misconception (a later resolution
 * supersedes an earlier one) and returns the updated list.
 */
export function savePersonalCard(
  conceptId: string,
  card: { misconceptionId: string; front: string; back: string },
): PersonalCard[] {
  const next: PersonalCard[] = [
    ...readPersonalCards(conceptId).filter(
      (c) => c.misconceptionId !== card.misconceptionId,
    ),
    {
      id: `personal:${card.misconceptionId}`,
      misconceptionId: card.misconceptionId,
      front: card.front,
      back: card.back,
      resolvedAt: new Date().toISOString(),
    },
  ];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY_PREFIX + conceptId, JSON.stringify(next));
    } catch {
      // Private browsing, quota exceeded, etc. — best effort only.
    }
  }
  return next;
}

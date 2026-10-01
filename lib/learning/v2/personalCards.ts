/**
 * Personalized flashcards, created the moment a misconception resolves in a
 * chat session (see useV2ChatSession) and shown as the "From you" deck
 * alongside the catalog-derived "Core" deck. Unlike Core cards, front/back
 * are the actual probe question and resolved feedback from that session, so
 * the answer is in the learner's own resolved language, not a generic
 * restatement. A second kind, "revisit", comes from the end-of-chat recap:
 * ideas that stayed shaky, saved as review cards with no misconception
 * attached. Kept in localStorage like the rest of v2's session memory —
 * per-browser, not per-person.
 */
export type PersonalCard = {
  id: string;
  /**
   * null for "revisit" cards (from the recap) and for follow-up questions
   * answered in a session beyond the one diagnosed gap.
   */
  misconceptionId: string | null;
  front: string;
  back: string;
  /** When the card was created (resolution time for resolved cards). */
  resolvedAt: string;
  /** Absent on cards saved before revisit cards existed; those are resolved cards. */
  kind?: "resolved" | "revisit";
};

/** Oldest revisit cards are dropped beyond this, so the deck can't grow unbounded. */
export const MAX_REVISIT_CARDS = 10;

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
function writeAll(conceptId: string, cards: PersonalCard[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + conceptId, JSON.stringify(cards));
  } catch {
    // Private browsing, quota exceeded, etc. — best effort only.
  }
}

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
      kind: "resolved",
    },
  ];
  writeAll(conceptId, next);
  return next;
}

function slugOf(front: string): string {
  return front
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function revisitId(front: string): string {
  return `revisit:${slugOf(front)}`;
}

/**
 * Adds a card for a question the learner answered correctly in a session
 * (beyond the first resolved gap, which has its own misconception card). A
 * question already saved is replaced, never duplicated. Returns the updated list.
 */
export function saveAnsweredCard(
  conceptId: string,
  card: { front: string; back: string },
): PersonalCard[] {
  const front = card.front.trim();
  const back = card.back.trim();
  if (!front || !back) return readPersonalCards(conceptId);

  const id = `answered:${slugOf(front)}`;
  const next: PersonalCard[] = [
    ...readPersonalCards(conceptId).filter((c) => c.id !== id),
    {
      id,
      misconceptionId: null,
      front,
      back,
      resolvedAt: new Date().toISOString(),
      kind: "resolved",
    },
  ];
  writeAll(conceptId, next);
  return next;
}

/**
 * Adds review cards for ideas that stayed shaky. A card for a question already
 * saved replaces the older one. Returns the updated list.
 */
export function saveRevisitCards(
  conceptId: string,
  cards: { front: string; back: string }[],
): PersonalCard[] {
  const fresh: PersonalCard[] = cards
    .filter((c) => c.front.trim() && c.back.trim())
    .map((c) => ({
      id: revisitId(c.front),
      misconceptionId: null,
      front: c.front.trim(),
      back: c.back.trim(),
      resolvedAt: new Date().toISOString(),
      kind: "revisit",
    }));
  if (fresh.length === 0) return readPersonalCards(conceptId);

  const freshIds = new Set(fresh.map((c) => c.id));
  const existing = readPersonalCards(conceptId).filter((c) => !freshIds.has(c.id));
  const kept = existing.filter((c) => c.kind !== "revisit");
  const older = existing.filter((c) => c.kind === "revisit");
  const revisit = [...older, ...fresh].slice(-MAX_REVISIT_CARDS);

  const next = [...kept, ...revisit];
  writeAll(conceptId, next);
  return next;
}

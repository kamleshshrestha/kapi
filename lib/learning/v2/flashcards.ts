import { getMisconceptionsForConcept } from "@/lib/learning/misconceptions";

export type Flashcard = {
  id: string;
  front: string;
  back: string;
};

/**
 * One flashcard per catalog misconception: a true/false prompt testing
 * whether the learner still holds the belief, with the correction as the
 * answer. Deterministic from existing content — no new authoring, no LLM
 * call, so review stays instant.
 */
export function getCoreCards(conceptId: string): Flashcard[] {
  return getMisconceptionsForConcept(conceptId).map((m) => ({
    id: m.id,
    front: `True or false: ${m.belief}`,
    back: `False. ${m.correction}`,
  }));
}

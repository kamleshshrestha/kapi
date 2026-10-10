import type { LastSessionOutcome } from "./localSession";
import type { PersonalCard } from "./personalCards";
import type { MasteryRating } from "./flashcardMastery";

/**
 * A tiny publish/subscribe channel for changes to the learner's local state,
 * so something else (account sync) can mirror them without the local modules
 * knowing about it. Writes that come *from* the account are applied silently
 * and never emit, so a pull cannot trigger a push.
 */
export type LocalChange =
  | { type: "last-session"; conceptId: string; outcome: LastSessionOutcome }
  | { type: "personal-cards"; conceptId: string; cards: PersonalCard[] }
  | { type: "mastery"; conceptId: string; cardId: string; rating: MasteryRating };

type Listener = (change: LocalChange) => void;

const listeners = new Set<Listener>();

export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLocalChange(change: LocalChange): void {
  for (const listener of listeners) {
    try {
      listener(change);
    } catch {
      // A failing listener must never break a local write.
    }
  }
}

"use client";

import { useEffect, useState } from "react";
import type { Flashcard } from "@/lib/learning/v2/flashcards";
import {
  readMastery,
  writeMastery,
  type MasteryMap,
  type MasteryRating,
} from "@/lib/learning/v2/flashcardMastery";

/**
 * Walks through `cards` once, then lets the learner requeue just the ones
 * they marked "forgot" or "fuzzy" for another pass — no spaced-repetition
 * scheduling, just an immediate re-review of what didn't stick.
 */
export function useFlashcardDeck(conceptId: string, cards: Flashcard[]) {
  const [queue, setQueue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastery, setMastery] = useState<MasteryMap>({});

  useEffect(() => {
    // Reads localStorage, unavailable during SSR — can't run during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMastery(readMastery(conceptId));
  }, [conceptId]);

  const card = queue[index];
  const done = index >= queue.length;

  function flip() {
    setFlipped((f) => !f);
  }

  function rate(rating: MasteryRating) {
    if (!card) return;
    setMastery(writeMastery(conceptId, card.id, rating));
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function restart() {
    setQueue(cards);
    setIndex(0);
    setFlipped(false);
  }

  function reviewMissed() {
    const missed = queue.filter((c) => {
      const rating = mastery[c.id];
      return rating === "forgot" || rating === "fuzzy";
    });
    setQueue(missed);
    setIndex(0);
    setFlipped(false);
  }

  return {
    card,
    index,
    total: queue.length,
    done,
    flipped,
    mastery,
    flip,
    rate,
    restart,
    reviewMissed,
  };
}

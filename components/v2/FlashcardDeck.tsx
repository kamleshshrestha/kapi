"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFlashcardDeck } from "@/hooks/useFlashcardDeck";
import Flashcard from "@/components/v2/Flashcard";
import type { Flashcard as FlashcardType } from "@/lib/learning/v2/flashcards";
import { readPersonalCards } from "@/lib/learning/v2/personalCards";
import type { MasteryRating } from "@/lib/learning/v2/flashcardMastery";
import { SYNCED_EVENT } from "@/lib/sync/enabled";

const RATINGS: { value: MasteryRating; label: string }[] = [
  { value: "forgot", label: "Forgot" },
  { value: "fuzzy", label: "Fuzzy" },
  { value: "got-it", label: "Got it" },
];

type DeckKind = "core" | "from-you";

export default function FlashcardDeck({
  conceptId,
  conceptTitle,
  coreCards,
}: {
  conceptId: string;
  conceptTitle: string;
  coreCards: FlashcardType[];
}) {
  const [personalCards, setPersonalCards] = useState<FlashcardType[]>([]);
  const [activeDeck, setActiveDeck] = useState<DeckKind>("core");

  useEffect(() => {
    // Reads localStorage, unavailable during SSR — can't run during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonalCards(readPersonalCards(conceptId));
    // Account sync may have brought in cards from another device.
    const reread = () => setPersonalCards(readPersonalCards(conceptId));
    window.addEventListener(SYNCED_EVENT, reread);
    return () => window.removeEventListener(SYNCED_EVENT, reread);
  }, [conceptId]);

  const cards = activeDeck === "core" ? coreCards : personalCards;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <DeckTab
          label={`Core (${coreCards.length})`}
          active={activeDeck === "core"}
          onClick={() => setActiveDeck("core")}
        />
        <DeckTab
          label={`From you (${personalCards.length})`}
          active={activeDeck === "from-you"}
          onClick={() => setActiveDeck("from-you")}
        />
      </div>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-foreground/10 p-6 text-foreground/70">
          {activeDeck === "core"
            ? `No flashcards for ${conceptTitle} yet.`
            : "No personalized cards yet — finish a chat session and the ideas you resolve or need to revisit will show up here."}
        </p>
      ) : (
        // Keyed so switching decks fully resets review progress.
        <DeckReview key={activeDeck} conceptId={conceptId} cards={cards} />
      )}
    </div>
  );
}

function DeckTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-foreground/20 text-foreground/60 hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );
}

function DeckReview({
  conceptId,
  cards,
}: {
  conceptId: string;
  cards: FlashcardType[];
}) {
  const { card, index, total, done, flipped, mastery, flip, rate, restart, reviewMissed } =
    useFlashcardDeck(conceptId, cards);

  if (done) {
    const counts = cards.reduce(
      (acc, c) => {
        const rating = mastery[c.id];
        if (rating) acc[rating] += 1;
        return acc;
      },
      { forgot: 0, fuzzy: 0, "got-it": 0 } as Record<MasteryRating, number>,
    );
    const missedCount = counts.forgot + counts.fuzzy;

    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-foreground/10 p-8">
        <h2 className="text-xl font-semibold">Deck complete</h2>
        <p className="text-foreground/70">
          {counts["got-it"]} got it, {counts.fuzzy} fuzzy, {counts.forgot} forgot — out
          of {cards.length}.
        </p>
        <div className="flex flex-wrap gap-3">
          {missedCount > 0 && (
            <button
              type="button"
              onClick={reviewMissed}
              className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground"
            >
              Review missed ({missedCount})
            </button>
          )}
          <button
            type="button"
            onClick={restart}
            className="rounded-full border border-foreground/20 px-5 py-2 font-medium"
          >
            Review again
          </button>
          <Link
            href="/"
            className="rounded-full border border-foreground/20 px-5 py-2 font-medium"
          >
            Back to concepts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-foreground/50">
        Card {index + 1} of {total}
      </p>
      <Flashcard front={card.front} back={card.back} flipped={flipped} onFlip={flip} />
      {flipped ? (
        <div className="flex justify-center gap-3">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => rate(r.value)}
              className="rounded-full border border-foreground/20 px-5 py-2 font-medium transition-colors hover:border-primary/40"
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-foreground/40">
          Flip the card, then rate how well you knew it.
        </p>
      )}
    </div>
  );
}

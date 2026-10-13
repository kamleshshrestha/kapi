"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readPersonalCards } from "@/lib/learning/v2/personalCards";
import { SYNCED_EVENT } from "@/lib/sync/enabled";

/**
 * Link to a concept's flashcards with the total number of cards: the Core
 * cards from the catalog plus the learner's own "From you" cards, which live
 * in this browser. The server renders the Core count; the personal ones are
 * added once they have been read, and again if an account sync brings in more.
 */
export default function CardCountLink({
  conceptId,
  coreCount,
}: {
  conceptId: string;
  coreCount: number;
}) {
  const [personalCount, setPersonalCount] = useState(0);

  useEffect(() => {
    // Reads localStorage, unavailable during SSR — can't run during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonalCount(readPersonalCards(conceptId).length);
    const reread = () => setPersonalCount(readPersonalCards(conceptId).length);
    window.addEventListener(SYNCED_EVENT, reread);
    return () => window.removeEventListener(SYNCED_EVENT, reread);
  }, [conceptId]);

  const total = coreCount + personalCount;
  return (
    <Link
      href={`/decks/${conceptId}`}
      className="mt-1 w-fit rounded-full border border-foreground/10 px-2 py-0.5 text-xs text-foreground/60 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      🗂 {total} {total === 1 ? "card" : "cards"}
    </Link>
  );
}

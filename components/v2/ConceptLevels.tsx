"use client";

import { useEffect, useState } from "react";
import LevelStrip from "@/components/v2/LevelStrip";
import { readConceptProgress } from "@/lib/learning/v2/levelStore";
import { nextStep, type LevelKey, type LevelState } from "@/lib/learning/v2/levels";

/**
 * The learner's depth levels for one concept, read from this browser. Renders
 * nothing on the server and until it has read them.
 */
export default function ConceptLevels({
  conceptId,
  compact = false,
  hideWhenEmpty = false,
  showNext = false,
}: {
  conceptId: string;
  compact?: boolean;
  /** For cards: show nothing until the learner has some progress here. */
  hideWhenEmpty?: boolean;
  /** Add the suggested next step under the levels. */
  showNext?: boolean;
}) {
  const [states, setStates] = useState<Record<LevelKey, LevelState> | null>(null);

  useEffect(() => {
    // Reads localStorage, unavailable during SSR — can't run during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStates(readConceptProgress(conceptId));
  }, [conceptId]);

  if (!states) return null;
  if (hideWhenEmpty && Object.values(states).every((s) => s === "none")) return null;

  return (
    <div className="flex flex-col gap-2">
      <LevelStrip states={states} compact={compact} />
      {showNext && <p className="text-sm text-foreground/70">{nextStep(states)}</p>}
    </div>
  );
}

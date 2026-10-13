import Link from "next/link";
import CardCountLink from "@/components/v2/CardCountLink";
import ConceptLevels from "@/components/v2/ConceptLevels";
import type { Concept } from "@/lib/learning/types";
import { getMisconceptionsForConcept } from "@/lib/learning/misconceptions";

export default function ConceptSelectorV2({
  concepts,
}: {
  concepts: Concept[];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {concepts.map((concept) => {
        // Core cards; the learner's own cards are added in the browser.
        const cardCount = getMisconceptionsForConcept(concept.id).length;
        return (
          <li
            key={concept.id}
            className="group flex h-full flex-col gap-2 rounded-xl border border-foreground/10 p-5 transition-colors hover:border-primary/40 hover:bg-primary/[.03]"
          >
            <Link
              href={`/learn/${concept.id}`}
              className="flex flex-col gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex items-center justify-between font-medium">
                {concept.title}
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
              <span className="text-sm text-foreground/60">
                {concept.summary}
              </span>
            </Link>
            <ConceptLevels conceptId={concept.id} compact hideWhenEmpty />
            {cardCount > 0 && <CardCountLink conceptId={concept.id} coreCount={cardCount} />}
          </li>
        );
      })}
    </ul>
  );
}

import Link from "next/link";
import type { SessionSummary as Summary } from "@/hooks/useV2ChatSession";

const SECTIONS: { key: keyof Summary; title: string }[] = [
  { key: "understood", title: "What you've got" },
  { key: "fixed", title: "What you fixed" },
  { key: "revisit", title: "Worth revisiting" },
];

export default function SessionSummary({
  summary,
  savedCards = 0,
  deckHref,
}: {
  summary: Summary;
  /** Revisit flashcards this recap just added to the learner's deck. */
  savedCards?: number;
  deckHref: string;
}) {
  const sections = SECTIONS.filter(({ key }) => summary[key].length > 0);
  if (sections.length === 0) return null;

  return (
    <section
      aria-label="Session recap"
      className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-6"
    >
      <h2 className="text-lg font-semibold">Your recap</h2>
      {sections.map(({ key, title }) => (
        <div key={key}>
          <h3 className="text-sm font-medium text-foreground/60">{title}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 leading-7">
            {summary[key].map((item, i) => (
              <li key={i}>{typeof item === "string" ? item : item.idea}</li>
            ))}
          </ul>
        </div>
      ))}
      {savedCards > 0 && (
        <p className="text-sm text-foreground/60">
          Added {savedCards === 1 ? "1 card" : `${savedCards} cards`} to your flashcards.{" "}
          <Link href={deckHref} className="font-medium text-primary underline">
            Review them
          </Link>
        </p>
      )}
    </section>
  );
}

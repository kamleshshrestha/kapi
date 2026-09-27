import Link from "next/link";
import { notFound } from "next/navigation";
import { getConcept } from "@/lib/learning/concepts";
import { getCoreCards } from "@/lib/learning/v2/flashcards";
import FlashcardDeck from "@/components/v2/FlashcardDeck";

export default async function V2DeckPage(
  props: PageProps<"/v2/decks/[concept]">,
) {
  const { concept: conceptId } = await props.params;
  const concept = getConcept(conceptId);
  if (!concept) notFound();

  const coreCards = getCoreCards(concept.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 sm:py-20">
      <header className="flex flex-col gap-3">
        <Link
          href="/v2"
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← All concepts
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {concept.title} — flashcards
        </h1>
      </header>

      <FlashcardDeck
        conceptId={concept.id}
        conceptTitle={concept.title}
        coreCards={coreCards}
      />
    </main>
  );
}

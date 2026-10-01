import Link from "next/link";
import { notFound } from "next/navigation";
import { getConcept } from "@/lib/learning/concepts";
import { getQuestionsForConcept } from "@/lib/learning/diagnostic";
import ChatThread from "@/components/v2/ChatThread";

export default async function V2LearnPage(
  props: PageProps<"/learn/[concept]">,
) {
  const { concept: conceptId } = await props.params;
  const concept = getConcept(conceptId);
  if (!concept) notFound();

  // Reuses an existing diagnostic question's options as quick-reply chips
  // when the learner's free-text explanation is too thin to diagnose from.
  const fallbackOptions =
    getQuestionsForConcept(concept.id)[0]?.options.map((o) => o.text) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 sm:py-20">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← All concepts
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {concept.title}
        </h1>
      </header>

      <ChatThread
        conceptId={concept.id}
        conceptTitle={concept.title}
        fallbackOptions={fallbackOptions}
      />
    </main>
  );
}

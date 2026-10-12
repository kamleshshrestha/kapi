import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConcept } from "@/lib/learning/concepts";
import { getMisconceptionsForConcept } from "@/lib/learning/misconceptions";
import TeachThread from "@/components/v2/TeachThread";

export const metadata: Metadata = {
  title: "Teach it back — Kapi",
};

export default async function TeachPage(props: PageProps<"/teach/[concept]">) {
  const { concept: conceptId } = await props.params;
  const concept = getConcept(conceptId);
  // Teaching needs the concept's misconception catalog to ask good questions.
  if (!concept || getMisconceptionsForConcept(concept.id).length === 0) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 sm:py-20">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm text-foreground/60 hover:text-foreground py-2 -my-2">
          ← All concepts
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Teach it back: {concept.title}</h1>
        <p className="text-foreground/70">
          Explain it to a curious beginner. Kapi will ask questions, then tell you how it went.
        </p>
      </header>
      <TeachThread conceptId={concept.id} conceptTitle={concept.title} />
    </main>
  );
}

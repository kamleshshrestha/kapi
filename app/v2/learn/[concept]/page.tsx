import Link from "next/link";
import { notFound } from "next/navigation";
import { getConcept } from "@/lib/learning/concepts";

export default async function V2LearnPage(
  props: PageProps<"/v2/learn/[concept]">,
) {
  const { concept: conceptId } = await props.params;
  const concept = getConcept(conceptId);
  if (!concept) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-12 sm:py-20">
      <header className="flex flex-col gap-3">
        <Link
          href="/v2"
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← All concepts
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {concept.title}
        </h1>
      </header>

      <p className="rounded-xl border border-foreground/10 p-6 leading-7 text-foreground/70">
        Chat session — coming soon.
      </p>
    </main>
  );
}

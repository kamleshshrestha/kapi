import Link from "next/link";
import { concepts } from "@/lib/learning/concepts";

export default function V2Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-foreground/60">
          Kapi v2 — work in progress
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Pick a concept
        </h1>
      </header>

      <ul className="flex flex-col gap-2">
        {concepts.map((concept) => (
          <li key={concept.id}>
            <Link
              href={`/v2/learn/${concept.id}`}
              className="text-foreground underline underline-offset-4 hover:text-foreground/70"
            >
              {concept.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

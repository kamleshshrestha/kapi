import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum — Kapi",
  description: "Who runs Kapi.",
};

export default function ImpressumPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">Impressum</h1>
      <p role="note" className="rounded-xl border border-foreground/10 p-4 text-sm">
        Draft: the details below must be filled in and checked before launch.
      </p>
      <p className="leading-7 text-foreground/80">
        [Name]
        <br />
        [Street and number]
        <br />
        [Postcode and city], Germany
      </p>
      <p className="leading-7 text-foreground/80">Contact: [email address]</p>
    </main>
  );
}

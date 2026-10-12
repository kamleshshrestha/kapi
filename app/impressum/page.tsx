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
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Information pursuant to § 5 DDG</h2>
        <p className="leading-7 text-foreground/80">
          Kamlesh Shrestha
          <br />
          Emdenzeille 1
          <br />
          13585 Berlin, Germany
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="leading-7 text-foreground/80">
          Email:{" "}
          <a href="mailto:kamleshshrestha.work@gmail.com" className="underline">
            kamleshshrestha.work@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}

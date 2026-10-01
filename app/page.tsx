import Image from "next/image";
import ConceptSelectorV2 from "@/components/v2/ConceptSelectorV2";
import { concepts } from "@/lib/learning/concepts";

export default function V2Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-4">
        <Image
          src="/brand/kapi-logo.png"
          alt="Kapi"
          width={604}
          height={176}
          preload
          className="h-10 w-auto self-start dark:hidden"
        />
        <Image
          src="/brand/kapi-logo-light.png"
          alt="Kapi"
          width={604}
          height={176}
          className="hidden h-10 w-auto self-start dark:block"
        />
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Find out what you actually misunderstand.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-foreground/70">
          Pick a concept and talk it through — Kapi will figure out the
          specific gap in your understanding and help you close it.
        </p>
      </header>

      <section aria-labelledby="pick-concept" className="flex flex-col gap-4">
        <h2 id="pick-concept" className="text-xl font-semibold">
          Pick a concept that isn&apos;t clicking
        </h2>
        <ConceptSelectorV2 concepts={concepts} />
      </section>
    </main>
  );
}

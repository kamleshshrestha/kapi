import Image from "next/image";
import ConceptSelectorV2 from "@/components/v2/ConceptSelectorV2";
import EmailAccount from "@/components/v2/EmailAccount";
import SyncNotice from "@/components/v2/SyncNotice";
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
          You think you understand it. Kapi finds out if you do.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-foreground/70">
          Explain a machine-learning concept in your own words. Kapi finds the
          specific gap in your understanding and helps you close it.
        </p>
        <ol className="mt-2 grid gap-3 text-sm leading-6 sm:grid-cols-3">
          {[
            ["1", "Explain it", "Pick a concept and say what you think it means."],
            ["2", "Find the gap", "Kapi pinpoints what you specifically get wrong."],
            ["3", "Close it", "Short questions and hints, then check you really got it."],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-xl border border-foreground/10 p-4">
              <span className="font-medium">
                {n}. {title}
              </span>
              <br />
              <span className="text-foreground/70">{text}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-foreground/60">
          No sign-up needed. Saving your progress is optional.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SyncNotice />
        <EmailAccount />
      </div>

      <section aria-labelledby="pick-concept" className="flex flex-col gap-4">
        <h2 id="pick-concept" className="text-xl font-semibold">
          Pick a concept that isn&apos;t clicking
        </h2>
        <ConceptSelectorV2 concepts={concepts} />
      </section>
    </main>
  );
}

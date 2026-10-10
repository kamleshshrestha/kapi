import type { Metadata } from "next";
import Link from "next/link";
import DataControls from "@/components/v2/DataControls";

export const metadata: Metadata = {
  title: "Privacy — Kapi",
  description: "What Kapi stores about you, why, and how to control it.",
};

const h2 = "text-xl font-semibold";
const p = "leading-7 text-foreground/80";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
      <p role="note" className="rounded-xl border border-foreground/10 p-4 text-sm">
        Draft: the responsible person&apos;s details below still need to be filled in
        and the text reviewed before launch.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Who is responsible</h2>
        <p className={p}>
          [Name], [street and number, postcode, city], Germany. Contact for
          privacy questions: [email address].
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>What Kapi stores, and why</h2>
        <p className={p}>
          By default, nothing about you is stored on a server. Your flashcards,
          card ratings and the gap you last worked on stay in this browser.
        </p>
        <p className={p}>
          If you choose &ldquo;Save my progress&rdquo;, Kapi creates an anonymous account tied to this
          browser (no email or name) and saves those same things there, so they
          are not lost if you clear your browsing data. This is needed to provide
          the saving feature you asked for. Your own chat messages are not part of
          it. Turn it off any time on the home page.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>What is sent to the AI service</h2>
        <p className={p}>
          To reply in the chat, the text you type is sent to an AI service
          (OpenRouter and the model provider it routes to) and processed there.
          Please do not type personal details about yourself or others.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Helping improve Kapi (optional)</h2>
        <p className={p}>
          Only if you switch it on below, and only with an account, Kapi keeps
          which gap was found, how each question went and a short excerpt of what
          you wrote, with emails, links and long numbers removed. It is used to
          improve the questions and prompts. Your consent is recorded, you can
          withdraw it at any time, and these records are deleted after 12 months.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Where it is stored, and for how long</h2>
        <p className={p}>
          Account data is stored with Supabase in Frankfurt, and the app is hosted
          on Vercel in Frankfurt. Anonymous accounts that are not used for 12
          months are deleted automatically.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Your rights</h2>
        <p className={p}>
          You can access and download your data, delete your account and its data,
          and withdraw consent at any time using the controls below. You can also
          contact the person responsible above, or complain to your data
          protection authority.
        </p>
      </section>

      <section aria-labelledby="your-data" className="flex flex-col gap-4">
        <h2 id="your-data" className={h2}>
          Your data
        </h2>
        <DataControls />
      </section>
    </main>
  );
}

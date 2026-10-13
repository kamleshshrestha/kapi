import type { Metadata } from "next";
import Link from "next/link";
import DataControls from "@/components/v2/DataControls";
import { isEmailSignInEnabled } from "@/lib/features";

export const metadata: Metadata = {
  title: "Privacy — Kapi",
  description: "What Kapi stores about you, why, and how to control it.",
};

const h2 = "text-xl font-semibold";
const p = "leading-7 text-foreground/80";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground py-2 -my-2">
        ← Back
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
      <section className="flex flex-col gap-3">
        <h2 className={h2}>Who is responsible</h2>
        <p className={p}>
          Kamlesh Shrestha, Emdenzeille 1, 13585 Berlin, Germany. Contact for
          privacy questions:{" "}
          <a href="mailto:kamleshshrestha.work@gmail.com" className="underline">
            kamleshshrestha.work@gmail.com
          </a>
          .
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>What Kapi stores, and why</h2>
        <p className={p}>
          By default, nothing about you is stored on a server. Your flashcards,
          card ratings, levels and the gap you last worked on stay in this browser.
        </p>
        <p className={p}>
          If you choose &ldquo;Save my progress&rdquo;, Kapi creates an anonymous account tied to this
          browser (no email or name) and saves those same things there, so they
          are not lost if you clear your browsing data. This is needed to provide
          the saving feature you asked for. Your own chat messages are not part of
          it. Turn it off any time on the home page.
        </p>
      </section>

      {isEmailSignInEnabled() && (
        <section className="flex flex-col gap-3">
          <h2 className={h2}>Email (optional)</h2>
          <p className={p}>
            You can add an email address to your account so you can sign in from
            another device. Kapi sends a 6-digit code to that address to confirm it
            and each time you sign in, and uses it for nothing else. The email is
            stored with your account, is included in your download and is deleted
            with your account. Accounts with an email are deleted after 24 months
            without use. The emails are sent through Supabase, which also hosts the account.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className={h2}>What is sent to the AI service</h2>
        <p className={p}>
          To reply in the chat, the text you type is sent to an AI service:
          OpenRouter, which passes it to the model provider that writes the reply
          (currently Anthropic&rsquo;s Claude). They process it only to produce
          that reply. Kapi does not send your name, email, account or IP address
          along with it. Please do not type personal details about yourself or
          others.
        </p>
        <p className={p}>
          Kapi asks OpenRouter to use only providers that neither store nor train
          on messages, and has switched off the storing of prompts in its
          OpenRouter account. OpenRouter acts as a processor for Kapi under a{" "}
          <a
            href="https://openrouter.ai/data-processing-agreement"
            rel="noopener noreferrer"
            className="underline"
          >
            data processing agreement
          </a>{" "}
          and states that it does not use messages for training. Beyond these
          settings, Kapi cannot control how the model provider handles the data,
          which is covered by the provider&rsquo;s own terms.
        </p>
        <p className={p}>
          OpenRouter is based in the USA, so your messages may be processed there.
          Transfers outside the EU rely on the standard contractual clauses
          approved by the European Commission.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Helping improve Kapi (optional)</h2>
        <p className={p}>
          Only if you switch it on below, and only with an account, Kapi keeps
          which gap was found, how each question went and a short excerpt of what
          you wrote, with emails, links and long numbers removed. It is used to
          improve the questions and prompts. Your consent is recorded and you can
          withdraw it at any time; withdrawing also deletes what was kept. These
          records are deleted after 12 months in any case.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Feedback you send</h2>
        <p className={p}>
          If you send feedback (after a session or on the feedback page), Kapi
          stores your answer, your comment with emails, links and long numbers
          removed, and the concept. If you have an account it is attached to it, so
          it is included in your download and deleted with your account; without
          one it is stored with no identifier. It is deleted after 12 months.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Usage counts</h2>
        <p className={p}>
          Kapi counts how often it is used, as daily totals: for example how many
          chats were started or finished per concept, and how many requests failed
          or were refused. A total has no account, address, cookie or text attached,
          so it cannot be traced to you, and nothing is counted in your browser.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Where it is stored, and for how long</h2>
        <p className={p}>
          Account data is stored with Supabase in Frankfurt, and the app is hosted
          on Vercel in Frankfurt. Anonymous accounts that are not used for 12
          months are deleted automatically (24 months if they have an email).
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Your rights</h2>
        <p className={p}>
          You can access and download your data, delete your account and its data,
          and withdraw consent at any time using the controls below. You can also
          contact the person responsible above, or complain to your data
          protection authority. For Berlin that is the Berliner Beauftragte für
          Datenschutz und Informationsfreiheit (datenschutz-berlin.de).
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

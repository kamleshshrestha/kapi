"use client";

import Link from "next/link";
import { useTeachBackSession, type TeachVerdict } from "@/hooks/useTeachBackSession";
import ChatBubble from "@/components/v2/ChatBubble";
import ChatInputBar from "@/components/v2/ChatInputBar";
import ConceptLevels from "@/components/v2/ConceptLevels";

const VERDICT_TEXT: Record<TeachVerdict, string> = {
  solid: "That was a solid explanation.",
  partial: "Mostly there, with a few gaps.",
  shaky: "Some of it needs another look.",
};

export default function TeachThread({
  conceptId,
  conceptTitle,
}: {
  conceptId: string;
  conceptTitle: string;
}) {
  const { messages, turn, maxTurns, pending, error, canRetry, done, assessment, submit, retry } =
    useTeachBackSession(conceptId, conceptTitle);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-1 flex-col gap-4">
        {messages.map((message, i) => (
          <ChatBubble key={i} role={message.role} text={message.text} />
        ))}
        {pending && (
          <p className="text-sm text-foreground/50" aria-live="polite">
            Kapi is thinking…
          </p>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <p>{error}</p>
            {canRetry && (
              <button type="button" onClick={retry} className="rounded-full border border-current px-3 py-1 text-sm">
                Try again
              </button>
            )}
          </div>
        )}
        {done && assessment && (
          <section
            aria-label="How your explanation went"
            className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-6"
          >
            <h2 className="text-lg font-semibold">{VERDICT_TEXT[assessment.verdict]}</h2>
            {assessment.clear.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground/60">What you made clear</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 leading-7">
                  {assessment.clear.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {assessment.gaps.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground/60">Worth revisiting</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 leading-7">
                  {assessment.gaps.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        {done && (
          <section
            aria-label="Where you stand"
            className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-6"
          >
            <h2 className="text-lg font-semibold">Where you stand on {conceptTitle}</h2>
            <ConceptLevels conceptId={conceptId} showNext />
          </section>
        )}
      </div>

      {done ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/learn/${conceptId}`}
            className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Practice {conceptTitle}
          </Link>
          <Link href="/" className="rounded-full border border-foreground/10 px-6 py-3 font-medium">
            Try another concept
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground/50">
            Your explanation {turn} of {maxTurns}
          </p>
          <ChatInputBar disabled={pending} pending={pending} onSubmit={submit} />
        </div>
      )}
    </div>
  );
}

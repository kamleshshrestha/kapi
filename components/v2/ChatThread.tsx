"use client";

import Link from "next/link";
import { ASSIST_ACTIONS, useV2ChatSession } from "@/hooks/useV2ChatSession";
import AssistChips from "@/components/v2/AssistChips";
import SessionSummary from "@/components/v2/SessionSummary";
import ChatBubble from "@/components/v2/ChatBubble";
import ChatInputBar from "@/components/v2/ChatInputBar";
import QuickReplyChips from "@/components/v2/QuickReplyChips";

export default function ChatThread({
  conceptId,
  conceptTitle,
  fallbackOptions,
}: {
  conceptId: string;
  conceptTitle: string;
  fallbackOptions: string[];
}) {
  const {
    messages,
    phase,
    quickReplies,
    pending,
    error,
    submit,
    assist,
    retry,
    canRetry,
    summary,
    summarizing,
    savedCards,
  } = useV2ChatSession(conceptId, conceptTitle, fallbackOptions);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-1 flex-col gap-4">
        {messages.map((message, i) => (
          <ChatBubble key={i} role={message.role} text={message.text} />
        ))}
        {pending && (
          <p className="text-sm text-foreground/50" aria-live="polite">
            Kapi is typing…
          </p>
        )}
        {quickReplies && (
          <QuickReplyChips
            options={quickReplies}
            disabled={pending}
            onPick={(text) => submit(text)}
          />
        )}
        {summarizing && (
          <p className="text-sm text-foreground/50" aria-live="polite">
            Kapi is putting together your recap…
          </p>
        )}
        {summary && (
          <SessionSummary
            summary={summary}
            savedCards={savedCards}
            deckHref={`/decks/${conceptId}`}
          />
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <p>{error}</p>
            {canRetry && (
              <button
                type="button"
                onClick={retry}
                aria-label="Try again"
                title="Try again"
                className="shrink-0 rounded-full border border-current p-1.5 transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {phase === "done" ? (
        <Link
          href="/"
          className="self-start rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
        >
          Try another concept
        </Link>
      ) : (
        <div className="flex flex-col gap-3">
          {phase === "await-check-answer" && (
            <AssistChips actions={ASSIST_ACTIONS} disabled={pending} onPick={assist} />
          )}
          <ChatInputBar disabled={pending} pending={pending} onSubmit={submit} />
        </div>
      )}
    </div>
  );
}

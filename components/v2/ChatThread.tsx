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
            deckHref={`/v2/decks/${conceptId}`}
          />
        )}
        {error && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {phase === "done" ? (
        <Link
          href="/v2"
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

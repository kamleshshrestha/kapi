"use client";

import { useState } from "react";

type Answer = "yes" | "partly" | "no";
type Status = "idle" | "sending" | "sent" | "error";

const ANSWERS: { value: Answer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partly", label: "Partly" },
  { value: "no", label: "No" },
];

/**
 * Asks whether Kapi found a real gap and lets the learner say what was off.
 * With no `conceptId` (the /feedback page) only the comment is shown.
 */
export default function FeedbackForm({ conceptId }: { conceptId?: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const canSend = (answer !== null || comment.trim() !== "") && status !== "sending";

  async function send() {
    setStatus("sending");
    try {
      const res = await fetch("/api/v2/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(answer ? { foundGap: answer } : {}),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          ...(conceptId ? { conceptId } : {}),
        }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p role="status" className="leading-7">
        Thanks, that helps.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) void send();
      }}
    >
      {conceptId && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">Did Kapi find a real gap in your understanding?</legend>
          <div className="flex gap-2">
            {ANSWERS.map(({ value, label }) => (
              <label
                key={value}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                  answer === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-foreground/10"
                }`}
              >
                <input
                  type="radio"
                  name="found-gap"
                  value={value}
                  checked={answer === value}
                  onChange={() => setAnswer(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="flex flex-col gap-2">
        <span className="font-medium">
          {conceptId ? "What was off or missing? (optional)" : "What would you like to tell us?"}
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          className="rounded-lg border border-foreground/10 bg-transparent p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      </label>
      <p className="text-sm text-foreground/60">
        Your answer is stored{conceptId ? " with the concept" : ""}
        {" "}to improve Kapi. Please don&apos;t include personal details.
      </p>
      {status === "error" && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          Could not send your feedback. Please try again.
        </p>
      )}
      <button
        type="submit"
        disabled={!canSend}
        className="self-start rounded-full bg-primary px-6 py-2.5 font-medium text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {status === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";

const MAX_LENGTH = 2000;

export default function ChatInputBar({
  disabled,
  pending,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="sticky bottom-0 flex items-end gap-2 border-t border-foreground/10 bg-background py-4"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        maxLength={MAX_LENGTH}
        rows={1}
        disabled={disabled}
        placeholder={
          pending ? "Kapi is typing…" : disabled ? "Session complete" : "Type your answer…"
        }
        className="max-h-40 flex-1 resize-none rounded-xl border border-foreground/20 bg-transparent p-3 leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="h-11 shrink-0 rounded-full bg-primary px-5 font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}

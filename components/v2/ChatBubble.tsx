import type { ChatMessage, ChatRole } from "@/lib/learning/v2/types";

export default function ChatBubble({
  role,
  text,
  kind,
}: {
  role: ChatRole;
  text: string;
  kind?: ChatMessage["kind"];
}) {
  const isLearner = role === "learner";

  // A formula is set apart from the talking, so it reads as something to look
  // at rather than another sentence. Plain text in monospace: there is no
  // LaTeX renderer, and `cleanFormula` has already dropped anything that
  // would not read correctly this way. It wraps at spaces on a narrow screen
  // rather than scrolling out of sight: a formula a beginner can only half
  // see is worse than one broken over two lines.
  if (kind === "formula") {
    return (
      <div className="flex flex-col gap-1 items-start">
        <code className="max-w-full overflow-x-auto rounded-xl border border-foreground/10 bg-foreground/[.03] px-4 py-3 font-mono text-sm leading-6 whitespace-pre-wrap">
          {text}
        </code>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${isLearner ? "items-end" : "items-start"}`}>
      <span className="text-xs font-medium text-foreground/60">
        {isLearner ? "You" : "Kapi"}
      </span>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 leading-6 ${
          isLearner
            ? "bg-primary text-primary-foreground"
            : "bg-foreground/5 text-foreground"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

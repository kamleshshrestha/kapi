import type { ChatRole } from "@/lib/learning/v2/types";

export default function ChatBubble({
  role,
  text,
}: {
  role: ChatRole;
  text: string;
}) {
  const isLearner = role === "learner";
  return (
    <div className={`flex flex-col gap-1 ${isLearner ? "items-end" : "items-start"}`}>
      <span className="text-xs font-medium text-foreground/40">
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

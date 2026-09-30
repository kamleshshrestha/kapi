import type { AssistKind } from "@/hooks/useV2ChatSession";

/** Ways to ask for help instead of answering the current question. */
export default function AssistChips({
  actions,
  onPick,
  disabled,
}: {
  actions: { kind: AssistKind; label: string }[];
  onPick: (kind: AssistKind) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Ask for help">
      {actions.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          disabled={disabled}
          onClick={() => onPick(kind)}
          className="rounded-full border border-dashed border-foreground/25 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

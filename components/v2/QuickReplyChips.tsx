export default function QuickReplyChips({
  options,
  onPick,
  disabled,
}: {
  options: string[];
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onPick(text)}
          className="rounded-full border border-foreground/20 px-4 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/[.03] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

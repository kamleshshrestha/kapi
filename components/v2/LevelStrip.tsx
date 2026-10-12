import { LEVELS, type LevelKey, type LevelState } from "@/lib/learning/v2/levels";

const STATE_WORD: Record<LevelState, string> = {
  none: "not started",
  building: "building",
  solid: "solid",
};

/** A circle: empty, half filled or filled. Decorative; the state is also in text. */
function Pip({ state }: { state: LevelState }) {
  return (
    <span
      aria-hidden
      className="inline-block size-3 shrink-0 rounded-full border border-primary text-primary"
      style={{
        background:
          state === "solid"
            ? "currentColor"
            : state === "building"
              ? "linear-gradient(90deg, currentColor 50%, transparent 50%)"
              : "transparent",
        opacity: state === "none" ? 0.35 : 1,
      }}
    />
  );
}

/** The four depth levels for a concept. `compact` is the small version for cards. */
export default function LevelStrip({
  states,
  compact = false,
}: {
  states: Record<LevelKey, LevelState>;
  compact?: boolean;
}) {
  return (
    <ul
      aria-label="Depth of understanding"
      className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? "text-xs text-foreground/60" : "text-sm"}`}
    >
      {LEVELS.map(({ key, label, description }) => (
        <li key={key} className="flex items-center gap-1.5" title={description}>
          <Pip state={states[key]} />
          <span>{label}</span>
          <span className="sr-only">: {STATE_WORD[states[key]]}</span>
          {!compact && (
            <span className="text-foreground/60">· {STATE_WORD[states[key]]}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

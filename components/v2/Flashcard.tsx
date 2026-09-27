export default function Flashcard({
  front,
  back,
  flipped,
  onFlip,
}: {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFlip}
      className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border border-foreground/10 p-8 text-center leading-7 transition-colors hover:border-primary/40"
    >
      <p>{flipped ? back : front}</p>
      <span className="text-xs text-foreground/40">
        {flipped ? "tap to flip back" : "tap to flip"}
      </span>
    </button>
  );
}

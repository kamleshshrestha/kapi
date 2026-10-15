"use client";

import { GATE_ACTIONS } from "@/lib/learning/v2/gate";
import type { GateKind } from "@/lib/learning/v2/gate";

/**
 * The checkpoint after Kapi's explanation. Going on is the main path, so it
 * gets the filled button; asking a question sits beside it as the quieter
 * option, and typing a question straight into the input works too.
 */
export default function GateChips({
  onPick,
  disabled,
}: {
  onPick: (kind: GateKind) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Does that make sense?">
      {GATE_ACTIONS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          disabled={disabled}
          onClick={() => onPick(kind)}
          className={
            kind === "ready"
              ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              : "rounded-full border border-foreground/20 px-4 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/[.03] disabled:cursor-not-allowed disabled:opacity-40"
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

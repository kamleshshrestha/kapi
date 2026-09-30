// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AssistChips from "@/components/v2/AssistChips";

afterEach(cleanup);

const ACTIONS = [
  { kind: "hint" as const, label: "Give me a hint" },
  { kind: "lost" as const, label: "I'm lost" },
];

describe("AssistChips", () => {
  it("reports the kind of help that was picked", () => {
    const onPick = vi.fn();
    render(<AssistChips actions={ACTIONS} onPick={onPick} disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Give me a hint" }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith("hint");
  });

  it("disables every chip when disabled", () => {
    const onPick = vi.fn();
    render(<AssistChips actions={ACTIONS} onPick={onPick} disabled />);

    for (const chip of screen.getAllByRole("button")) expect(chip).toBeDisabled();
  });
});

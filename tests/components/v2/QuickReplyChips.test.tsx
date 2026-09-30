// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import QuickReplyChips from "@/components/v2/QuickReplyChips";

afterEach(cleanup);

describe("QuickReplyChips", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(
      <QuickReplyChips options={[]} onPick={vi.fn()} disabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onPick with the chosen option's text", () => {
    const onPick = vi.fn();
    render(
      <QuickReplyChips options={["One", "Two"]} onPick={onPick} disabled={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Two" }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith("Two");
  });

  it("disables every chip when disabled", () => {
    const onPick = vi.fn();
    render(<QuickReplyChips options={["One", "Two"]} onPick={onPick} disabled />);

    for (const chip of screen.getAllByRole("button")) expect(chip).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "One" }));
    expect(onPick).not.toHaveBeenCalled();
  });
});

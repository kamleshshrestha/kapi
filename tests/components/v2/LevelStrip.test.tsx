// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LevelStrip from "@/components/v2/LevelStrip";

afterEach(cleanup);

const states = { recognize: "solid", explain: "building", apply: "none", defend: "none" } as const;

describe("LevelStrip", () => {
  it("lists the four levels with their state in words, not only in the circles", () => {
    render(<LevelStrip states={states} />);
    const list = screen.getByRole("list", { name: "Depth of understanding" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Recognize: solid· solid",
      "Explain: building· building",
      "Apply: not started· not started",
      "Defend: not started· not started",
    ]);
  });

  it("the compact version keeps the state for screen readers but drops the visible words", () => {
    render(<LevelStrip states={states} compact />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Explain: building");
    expect(items[1]).not.toHaveTextContent("· building");
  });

  it("explains each level in a tooltip", () => {
    render(<LevelStrip states={states} />);
    expect(screen.getByText("Defend").closest("li")).toHaveAttribute(
      "title",
      expect.stringContaining("tough what-if"),
    );
  });
});

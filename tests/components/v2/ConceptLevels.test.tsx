// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ConceptLevels from "@/components/v2/ConceptLevels";
import ConceptSelectorV2 from "@/components/v2/ConceptSelectorV2";
import { concepts } from "@/lib/learning/concepts";
import { recordEvidence } from "@/lib/learning/v2/levelStore";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("ConceptLevels", () => {
  it("shows empty levels and the first suggestion for a new learner when asked to", async () => {
    render(<ConceptLevels conceptId="overfitting" showNext />);
    expect(await screen.findByRole("list", { name: "Depth of understanding" })).toBeInTheDocument();
    expect(screen.getByText(/explain the idea in your own words/i)).toBeInTheDocument();
  });

  it("shows the learner's progress from this browser", async () => {
    for (let i = 0; i < 3; i++) recordEvidence("overfitting", "explain", "clean");
    recordEvidence("overfitting", "apply", "clean");
    render(<ConceptLevels conceptId="overfitting" showNext />);

    expect((await screen.findByText("Explain")).closest("li")).toHaveTextContent("solid");
    expect(screen.getByText("Apply").closest("li")).toHaveTextContent("building");
    expect(screen.getByText(/practice applying it/i)).toBeInTheDocument();
  });

  it("can stay hidden until there is some progress (for cards)", async () => {
    const { container, rerender } = render(<ConceptLevels conceptId="overfitting" hideWhenEmpty />);
    // let the effect run
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();

    recordEvidence("overfitting", "defend", "helped");
    rerender(<ConceptLevels conceptId="gradient-descent" hideWhenEmpty />);
    rerender(<ConceptLevels conceptId="overfitting" hideWhenEmpty />);
    expect(await screen.findByRole("list")).toBeInTheDocument();
  });

  it("keeps each concept's levels separate", async () => {
    recordEvidence("gradient-descent", "explain", "clean");
    render(<ConceptLevels conceptId="overfitting" showNext />);
    expect((await screen.findByText("Explain")).closest("li")).toHaveTextContent("not started");
  });
});

describe("home concept cards", () => {
  it("show levels only for the concepts the learner has worked on", async () => {
    recordEvidence("overfitting", "explain", "clean");
    render(<ConceptSelectorV2 concepts={concepts} />);

    const lists = await screen.findAllByRole("list", { name: "Depth of understanding" });
    expect(lists).toHaveLength(1);
    expect(lists[0].closest("li")).toHaveTextContent("Overfitting");
  });
});

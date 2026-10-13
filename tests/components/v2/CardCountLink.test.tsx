// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import CardCountLink from "@/components/v2/CardCountLink";
import ConceptSelectorV2 from "@/components/v2/ConceptSelectorV2";
import { concepts } from "@/lib/learning/concepts";
import { getCoreCards } from "@/lib/learning/v2/flashcards";
import { applyRemotePersonalCards, saveRevisitCards, type PersonalCard } from "@/lib/learning/v2/personalCards";
import { SYNCED_EVENT } from "@/lib/sync/enabled";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const personal = (id: string): PersonalCard => ({
  id,
  misconceptionId: null,
  front: "Q",
  back: "A",
  resolvedAt: "2026-01-01T00:00:00.000Z",
  kind: "revisit",
});

describe("CardCountLink", () => {
  it("shows the Core count when the learner has no cards of their own", async () => {
    render(<CardCountLink conceptId="overfitting" coreCount={4} />);
    expect(await screen.findByRole("link", { name: /4 cards/ })).toHaveAttribute("href", "/decks/overfitting");
  });

  it("adds the learner's own cards to the Core count", async () => {
    applyRemotePersonalCards("overfitting", [personal("a"), personal("b"), personal("c")]);
    render(<CardCountLink conceptId="overfitting" coreCount={4} />);
    expect(await screen.findByRole("link", { name: /7 cards/ })).toBeInTheDocument();
  });

  it("counts cards saved by a chat recap", async () => {
    saveRevisitCards("overfitting", [{ front: "What is L2?", back: "A penalty on weights." }]);
    render(<CardCountLink conceptId="overfitting" coreCount={4} />);
    expect(await screen.findByRole("link", { name: /5 cards/ })).toBeInTheDocument();
  });

  it("keeps each concept's cards separate", async () => {
    applyRemotePersonalCards("gradient-descent", [personal("a")]);
    render(<CardCountLink conceptId="overfitting" coreCount={4} />);
    expect(await screen.findByRole("link", { name: /4 cards/ })).toBeInTheDocument();
  });

  it("updates when an account sync brings in cards from another device", async () => {
    render(<CardCountLink conceptId="overfitting" coreCount={4} />);
    expect(await screen.findByRole("link", { name: /4 cards/ })).toBeInTheDocument();

    act(() => {
      applyRemotePersonalCards("overfitting", [personal("a"), personal("b")]);
      window.dispatchEvent(new Event(SYNCED_EVENT));
    });
    expect(screen.getByRole("link", { name: /6 cards/ })).toBeInTheDocument();
  });
});

describe("ConceptSelectorV2 card counts", () => {
  it("matches the number of cards the deck page will show (Core plus From you)", async () => {
    applyRemotePersonalCards("overfitting", [personal("a"), personal("b"), personal("c")]);
    render(<ConceptSelectorV2 concepts={concepts} />);
    const expected = getCoreCards("overfitting").length + 3;
    expect(await screen.findByRole("link", { name: new RegExp(`${expected} cards`) })).toHaveAttribute(
      "href",
      "/decks/overfitting",
    );
  });
});

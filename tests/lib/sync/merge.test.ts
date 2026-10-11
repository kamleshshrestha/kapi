import { describe, expect, it } from "vitest";
import {
  mergeCards,
  mergeLastSession,
  mergeLevels,
  mergeMastery,
  sameCards,
  sameLevels,
  sameMastery,
} from "@/lib/sync/merge";
import { MAX_REVISIT_CARDS, type PersonalCard } from "@/lib/learning/v2/personalCards";

const card = (id: string, at: string, extra: Partial<PersonalCard> = {}): PersonalCard => ({
  id,
  misconceptionId: null,
  front: `q-${id}`,
  back: `a-${id}`,
  resolvedAt: at,
  kind: "resolved",
  ...extra,
});

const outcome = (at: string) => ({
  misconceptionId: "m",
  misconceptionTitle: "t",
  resolved: true,
  at,
});

describe("mergeLastSession", () => {
  it("takes whichever side exists", () => {
    expect(mergeLastSession(null, null)).toBeNull();
    expect(mergeLastSession(outcome("2026-01-01T00:00:00.000Z"), null)?.at).toBe("2026-01-01T00:00:00.000Z");
    expect(mergeLastSession(null, outcome("2026-01-02T00:00:00.000Z"))?.at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("prefers the newer outcome", () => {
    const older = outcome("2026-01-01T00:00:00.000Z");
    const newer = outcome("2026-02-01T00:00:00.000Z");
    expect(mergeLastSession(older, newer)).toBe(newer);
    expect(mergeLastSession(newer, older)).toBe(newer);
  });
});

describe("mergeCards", () => {
  it("unions by id, keeping local order and appending remote-only cards", () => {
    const merged = mergeCards(
      [card("a", "2026-01-01T00:00:00.000Z")],
      [card("b", "2026-01-02T00:00:00.000Z")],
    );
    expect(merged.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("lets the later version of a card win", () => {
    const local = card("a", "2026-01-01T00:00:00.000Z", { back: "old" });
    const remote = card("a", "2026-02-01T00:00:00.000Z", { back: "new" });
    expect(mergeCards([local], [remote])[0].back).toBe("new");
    expect(mergeCards([remote], [local])[0].back).toBe("new");
  });

  it("keeps only the newest revisit cards", () => {
    const many = Array.from({ length: MAX_REVISIT_CARDS + 3 }, (_, i) =>
      card(`r${i}`, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`, { kind: "revisit" }),
    );
    const merged = mergeCards(many.slice(0, 5), many.slice(5));
    expect(merged).toHaveLength(MAX_REVISIT_CARDS);
    expect(merged.map((c) => c.id)).not.toContain("r0");
    expect(merged.map((c) => c.id)).toContain(`r${MAX_REVISIT_CARDS + 2}`);
  });
});

describe("mergeMastery and equality helpers", () => {
  it("lets the account win a clash", () => {
    expect(mergeMastery({ a: "forgot", b: "got-it" }, { a: "fuzzy" })).toEqual({
      a: "fuzzy",
      b: "got-it",
    });
  });

  it("compares decks and ratings by content, ignoring order", () => {
    const a = card("a", "2026-01-01T00:00:00.000Z");
    const b = card("b", "2026-01-02T00:00:00.000Z");
    expect(sameCards([a, b], [b, a])).toBe(true);
    expect(sameCards([a], [{ ...a, back: "changed" }])).toBe(false);
    expect(sameCards([a], [a, b])).toBe(false);
    expect(sameMastery({ x: "got-it" }, { x: "got-it" })).toBe(true);
    expect(sameMastery({ x: "got-it" }, { x: "forgot" })).toBe(false);
  });
});

describe("mergeLevels and sameLevels", () => {
  const T1 = "2026-01-01T00:00:00.000Z";
  const T2 = "2026-02-01T00:00:00.000Z";

  it("takes the higher counts per level and the later time", () => {
    const merged = mergeLevels(
      { explain: { clean: 3, helped: 0, at: T1 }, apply: { clean: 1, helped: 2, at: T2 } },
      { explain: { clean: 2, helped: 1, at: T2 }, defend: { clean: 1, helped: 0, at: T1 } },
    );
    expect(merged).toEqual({
      explain: { clean: 3, helped: 1, at: T2 },
      apply: { clean: 1, helped: 2, at: T2 },
      defend: { clean: 1, helped: 0, at: T1 },
    });
  });

  it("does not double-count when both sides already agree (it runs on every startup)", () => {
    const same = { explain: { clean: 2, helped: 1, at: T1 } };
    expect(mergeLevels(same, same)).toEqual(same);
  });

  it("is empty when both sides are", () => {
    expect(mergeLevels({}, {})).toEqual({});
  });

  it("compares levels by content", () => {
    const a = { explain: { clean: 1, helped: 0, at: T1 } };
    expect(sameLevels(a, { explain: { clean: 1, helped: 0, at: T1 } })).toBe(true);
    expect(sameLevels(a, { explain: { clean: 2, helped: 0, at: T1 } })).toBe(false);
    expect(sameLevels(a, {})).toBe(false);
    expect(sameLevels({}, {})).toBe(true);
  });
});


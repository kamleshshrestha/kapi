// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onLocalChange, emitLocalChange, type LocalChange } from "@/lib/learning/v2/changeEvents";
import { writeLastSession, applyRemoteLastSession } from "@/lib/learning/v2/localSession";
import { savePersonalCard, applyRemotePersonalCards } from "@/lib/learning/v2/personalCards";
import { writeMastery, applyRemoteMastery } from "@/lib/learning/v2/flashcardMastery";

const changes: LocalChange[] = [];
let off: () => void;

beforeEach(() => {
  window.localStorage.clear();
  changes.length = 0;
  off = onLocalChange((c) => changes.push(c));
});
afterEach(() => off());

describe("local change events", () => {
  it("emits when the learner writes", () => {
    writeLastSession("overfitting", {
      misconceptionId: "m",
      misconceptionTitle: "t",
      resolved: false,
      at: "2026-01-01T00:00:00.000Z",
    });
    savePersonalCard("overfitting", { misconceptionId: "m", front: "q", back: "a" });
    writeMastery("overfitting", "card-1", "fuzzy");
    expect(changes.map((c) => c.type)).toEqual(["last-session", "personal-cards", "mastery"]);
  });

  it("stays silent when state comes from the account", () => {
    applyRemoteLastSession("overfitting", {
      misconceptionId: "m",
      misconceptionTitle: "t",
      resolved: true,
      at: "2026-01-01T00:00:00.000Z",
    });
    applyRemotePersonalCards("overfitting", []);
    applyRemoteMastery("overfitting", { a: "got-it" });
    expect(changes).toEqual([]);
  });

  it("does not let a failing listener break the write or other listeners", () => {
    const offBad = onLocalChange(() => {
      throw new Error("boom");
    });
    expect(() => writeMastery("overfitting", "c", "forgot")).not.toThrow();
    expect(changes).toHaveLength(1);
    offBad();
  });

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn();
    const stop = onLocalChange(listener);
    stop();
    emitLocalChange({ type: "mastery", conceptId: "x", cardId: "c", rating: "got-it" });
    expect(listener).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const remote = vi.hoisted(() => ({
  pullAll: vi.fn(),
  pushLastSession: vi.fn(),
  replaceCards: vi.fn(),
  pushMastery: vi.fn(),
}));
vi.mock("@/lib/sync/remote", () => remote);

import { hydrate, startPushing } from "@/lib/sync/sync";
import { SYNCED_EVENT } from "@/lib/sync/enabled";
import { readPersonalCards, savePersonalCard } from "@/lib/learning/v2/personalCards";
import { readMastery, writeMastery } from "@/lib/learning/v2/flashcardMastery";

const db = {} as SupabaseClient;
const emptyRemote = { lastSessions: {}, cards: {}, mastery: {} };

beforeEach(() => {
  window.localStorage.clear();
  Object.values(remote).forEach((f) => f.mockReset());
  remote.pushLastSession.mockResolvedValue(undefined);
  remote.replaceCards.mockResolvedValue(undefined);
  remote.pushMastery.mockResolvedValue(undefined);
});

describe("hydrate", () => {
  it("uploads existing local data the first time (empty account)", async () => {
    savePersonalCard("overfitting", { misconceptionId: "m", front: "q", back: "a" });
    writeMastery("overfitting", "personal:m", "got-it");
    remote.pullAll.mockResolvedValue(emptyRemote);
    remote.replaceCards.mockClear();
    remote.pushMastery.mockClear();

    await hydrate(db, "u1");

    expect(remote.replaceCards).toHaveBeenCalledWith(db, "u1", "overfitting", expect.arrayContaining([expect.objectContaining({ id: "personal:m" })]));
    expect(remote.pushMastery).toHaveBeenCalledWith(db, "u1", "overfitting", { "personal:m": "got-it" });
  });

  it("brings the account's data into a fresh browser without pushing it back", async () => {
    remote.pullAll.mockResolvedValue({
      lastSessions: {},
      cards: {
        overfitting: [{ id: "personal:m", misconceptionId: "m", front: "q", back: "a", resolvedAt: "2026-01-01T00:00:00.000Z", kind: "resolved" }],
      },
      mastery: { overfitting: { "personal:m": "fuzzy" } },
    });
    const synced = vi.fn();
    window.addEventListener(SYNCED_EVENT, synced);

    await hydrate(db, "u1");

    expect(readPersonalCards("overfitting")).toHaveLength(1);
    expect(readMastery("overfitting")).toEqual({ "personal:m": "fuzzy" });
    expect(remote.replaceCards).not.toHaveBeenCalled();
    expect(remote.pushMastery).not.toHaveBeenCalled();
    expect(synced).toHaveBeenCalledTimes(1);
    window.removeEventListener(SYNCED_EVENT, synced);
  });

  it("rejects when the account cannot be read, leaving local data alone", async () => {
    savePersonalCard("overfitting", { misconceptionId: "m", front: "q", back: "a" });
    remote.pullAll.mockRejectedValue(new Error("offline"));
    await expect(hydrate(db, "u1")).rejects.toThrow("offline");
    expect(readPersonalCards("overfitting")).toHaveLength(1);
  });
});

describe("startPushing", () => {
  it("mirrors local changes and swallows failed pushes", async () => {
    const stop = startPushing(db, "u1");
    remote.pushMastery.mockRejectedValue(new Error("offline"));

    writeMastery("overfitting", "c1", "forgot");
    savePersonalCard("overfitting", { misconceptionId: "m", front: "q", back: "a" });

    expect(remote.pushMastery).toHaveBeenCalledWith(db, "u1", "overfitting", { c1: "forgot" });
    expect(remote.replaceCards).toHaveBeenCalledTimes(1);
    await Promise.resolve(); // let the rejected push settle; it must not surface

    stop();
    writeMastery("overfitting", "c2", "got-it");
    expect(remote.pushMastery).toHaveBeenCalledTimes(1);
  });
});

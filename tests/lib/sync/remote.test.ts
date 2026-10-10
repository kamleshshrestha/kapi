import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pullAll, pushMastery, replaceCards } from "@/lib/sync/remote";

type Call = { table: string; op: string; args: unknown[] };

/** A minimal stand-in for the supabase-js query builder. */
function fakeDb(tables: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const builder = {
        upsert: (...args: unknown[]) => {
          calls.push({ table, op: "upsert", args });
          return Promise.resolve({ error: null });
        },
        select: (...args: unknown[]) => {
          calls.push({ table, op: "select", args });
          const result = Promise.resolve({ data: tables[table] ?? [], error: null });
          return Object.assign(result, { eq: () => result });
        },
        delete: () => {
          calls.push({ table, op: "delete", args: [] });
          const chain = {
            eq: (...a: unknown[]) => {
              calls.push({ table, op: "delete.eq", args: a });
              return chain;
            },
            in: (...a: unknown[]) => {
              calls.push({ table, op: "delete.in", args: a });
              return Promise.resolve({ error: null });
            },
          };
          return chain;
        },
      };
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

describe("pullAll", () => {
  it("maps rows into the local shapes and normalises timestamps", async () => {
    const { db } = fakeDb({
      last_sessions: [
        { concept_id: "overfitting", misconception_id: "m", misconception_title: "t", resolved: true, at: "2026-01-01T10:00:00+00:00" },
      ],
      personal_cards: [
        { concept_id: "overfitting", id: "personal:m", misconception_id: "m", front: "q", back: "a", resolved_at: "2026-01-01T10:00:00+00:00", kind: "resolved" },
      ],
      card_mastery: [{ concept_id: "overfitting", card_id: "personal:m", rating: "fuzzy" }],
    });
    const state = await pullAll(db);
    expect(state.lastSessions.overfitting.at).toBe("2026-01-01T10:00:00.000Z");
    expect(state.cards.overfitting[0]).toMatchObject({ id: "personal:m", resolvedAt: "2026-01-01T10:00:00.000Z", kind: "resolved" });
    expect(state.mastery.overfitting).toEqual({ "personal:m": "fuzzy" });
  });

  it("throws when a query fails, so the caller can fall back to local-only", async () => {
    const failing = {
      from: () => ({ select: () => Promise.resolve({ data: null, error: { message: "nope" } }) }),
    } as unknown as SupabaseClient;
    await expect(pullAll(failing)).rejects.toThrow("last_sessions select: nope");
  });
});

describe("replaceCards", () => {
  const card = (id: string) => ({
    id,
    misconceptionId: null,
    front: "q",
    back: "a",
    resolvedAt: "2026-01-01T00:00:00.000Z",
    kind: "resolved" as const,
  });

  it("upserts the current deck and deletes cards that are no longer local", async () => {
    const { db, calls } = fakeDb({ personal_cards: [{ id: "keep" }, { id: "gone" }] });
    await replaceCards(db, "u1", "overfitting", [card("keep")]);
    const upsert = calls.find((c) => c.op === "upsert");
    expect((upsert?.args[0] as { user_id: string; id: string }[])[0]).toMatchObject({ user_id: "u1", id: "keep", concept_id: "overfitting" });
    expect(calls.find((c) => c.op === "delete.in")?.args).toEqual(["id", ["gone"]]);
  });

  it("deletes nothing when the account already matches", async () => {
    const { db, calls } = fakeDb({ personal_cards: [{ id: "keep" }] });
    await replaceCards(db, "u1", "overfitting", [card("keep")]);
    expect(calls.some((c) => c.op === "delete")).toBe(false);
  });
});

describe("pushMastery", () => {
  it("skips the request when there is nothing to send", async () => {
    const upsert = vi.fn();
    const db = { from: () => ({ upsert }) } as unknown as SupabaseClient;
    await pushMastery(db, "u1", "overfitting", {});
    expect(upsert).not.toHaveBeenCalled();
  });
});

import { getCoreCards } from "./flashcards";
import { readMastery } from "./flashcardMastery";
import {
  addEvidence,
  conceptProgress,
  type ConceptLevels,
  type EvidenceKind,
  type EvidenceLevel,
  type LevelKey,
  type LevelProgress,
  type LevelState,
} from "./levels";

/**
 * The learner's depth levels per concept, kept in localStorage like the rest
 * of v2's session memory (per-browser until account sync covers it).
 */
const KEY_PREFIX = "kapi:v2:levels:";
const EVIDENCE_LEVELS: EvidenceLevel[] = ["explain", "apply", "defend"];

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/** Keeps only well-formed entries, so a damaged value can't break the page. */
function sanitize(raw: unknown): ConceptLevels {
  const levels: ConceptLevels = {};
  if (!raw || typeof raw !== "object") return levels;
  for (const level of EVIDENCE_LEVELS) {
    const entry = (raw as Record<string, Partial<LevelProgress> | undefined>)[level];
    if (!entry || typeof entry.at !== "string") continue;
    levels[level] = { clean: count(entry.clean), helped: count(entry.helped), at: entry.at };
  }
  return levels;
}

export function readLevels(conceptId: string): ConceptLevels {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + conceptId);
    return raw ? sanitize(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function writeLevels(conceptId: string, levels: ConceptLevels): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + conceptId, JSON.stringify(levels));
  } catch {
    // Private browsing, quota exceeded, etc. — best effort only.
  }
}

/** Adds one piece of evidence for a level and returns the updated levels. */
export function recordEvidence(
  conceptId: string,
  level: EvidenceLevel,
  kind: EvidenceKind,
): ConceptLevels {
  const next = addEvidence(readLevels(conceptId), level, kind, new Date().toISOString());
  writeLevels(conceptId, next);
  return next;
}

/** The four level states for a concept, combining chat evidence and flashcard ratings. */
export function readConceptProgress(conceptId: string): Record<LevelKey, LevelState> {
  const cardIds = getCoreCards(conceptId).map((c) => c.id);
  return conceptProgress(readLevels(conceptId), cardIds, readMastery(conceptId));
}

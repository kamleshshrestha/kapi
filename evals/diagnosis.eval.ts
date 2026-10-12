import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { getConcept } from "@/lib/learning/concepts";
import { getMisconception, getMisconceptionsForConcept } from "@/lib/learning/misconceptions";
import { MAX_CHAT_TURNS } from "@/lib/learning/v2/chatFlow";
import { MODEL, generateStructured } from "@/lib/llm/client";
import { guardAgainstLeak } from "@/lib/llm/leakGuard";
import { chatCheckPrompt, chatDiagnosePrompt, leakCheckPrompt } from "@/lib/llm/prompts";
import {
  chatCheckOutputSchema,
  chatDiagnoseOutputSchema,
  leakCheckOutputSchema,
} from "@/lib/llm/schemas";
import { evalCases, type EvalCase } from "./cases";

/**
 * Runs the real prompts against the real model for every case in cases.ts:
 * - diagnosis: does it name an acceptable misconception (or none, for a strong
 *   explanation)? Graded by exact id.
 * - first miss: for a case with a gap, the learner answers the probe by
 *   restating the misconception. The model should give a hint, and neither the
 *   feedback nor the hint may give the answer away. That is judged by a
 *   DIFFERENT model (EVAL_JUDGE_MODEL), because a model grading itself is not
 *   evidence. Two numbers: "raw" is the model's own output, "guarded" is what
 *   the learner sees after the app's reviewer pass (guardAgainstLeak, the
 *   production code). Only the guarded number is held to a threshold.
 *
 * Thresholds (env): EVAL_MIN_ACCURACY (default 0.9), EVAL_MAX_LEAKS (2, on the
 * guarded text), EVAL_MAX_SKIPPED_HINTS (1), EVAL_MAX_ERRORS (1). They are a
 * tripwire, not a precise measure: with about 17 judged hints and an LLM judge,
 * the flagged count moves by a few between identical runs (3, 6 and 2 raw
 * leaks in three runs on the same cases), so look at the texts in last-run.json
 * before concluding anything from one run. Results are also written to evals/last-run.json.
 */
const JUDGE = process.env.EVAL_JUDGE_MODEL ?? "openai/gpt-oss-120b";
const MIN_ACCURACY = Number(process.env.EVAL_MIN_ACCURACY ?? "0.9");
const MAX_LEAKS = Number(process.env.EVAL_MAX_LEAKS ?? "2");
const MAX_ERRORS = Number(process.env.EVAL_MAX_ERRORS ?? "1");
const MAX_SKIPPED_HINTS = Number(process.env.EVAL_MAX_SKIPPED_HINTS ?? "1");
const CONCURRENCY = 4;

type Result = {
  id: number;
  conceptId: string;
  kind: EvalCase["kind"];
  expected: string[];
  got: string | null;
  diagnosisOk: boolean;
  verdict?: string;
  hinted?: boolean;
  skippedHint?: boolean;
  /** The judge says the model's own feedback/hint gives the answer away. */
  rawLeak?: boolean;
  /** The same, after the app's reviewer pass. */
  guardedLeak?: boolean;
  /** What was said, kept in last-run.json so a flagged leak can be read. */
  text?: {
    question: string;
    feedback: string;
    hint: string | null;
    guardedFeedback?: string | null;
    guardedHint?: string;
  };
  error?: string;
};

function firstPerson(belief: string): string {
  return `I think ${belief.charAt(0).toLowerCase()}${belief.slice(1)}`;
}

/** Tags a failure with the step it happened in, so an error says which call broke. */
async function stage<T>(name: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new Error(`[${name}] ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runCase(c: EvalCase): Promise<Result> {
  const concept = getConcept(c.conceptId)!;
  const misconceptions = getMisconceptionsForConcept(c.conceptId);
  const result: Result = {
    id: c.id,
    conceptId: c.conceptId,
    kind: c.kind,
    expected: c.acceptable,
    got: null,
    diagnosisOk: false,
  };
  try {
    const diagnosis = await stage("diagnose", () =>
      generateStructured({
        ...chatDiagnosePrompt({ concept, misconceptions, explanation: c.explanation }),
        schema: chatDiagnoseOutputSchema(misconceptions.map((m) => m.id)),
      }),
    );
    result.got = diagnosis.primaryMisconceptionId;
    result.diagnosisOk =
      c.acceptable.length === 0
        ? result.got === null
        : result.got !== null && c.acceptable.includes(result.got);

    const misconception = result.got ? (getMisconception(result.got) ?? null) : null;
    const probe = diagnosis.probeQuestion;
    if (c.acceptable.length === 0 || !probe) return result;

    const check = await stage("check", () =>
      generateStructured({
      ...chatCheckPrompt({
        concept,
        misconception,
        question: probe,
        answer: firstPerson(getMisconception(c.acceptable[0])!.belief),
        history: [],
        turn: 1,
        maxTurns: MAX_CHAT_TURNS,
        attempt: 1,
        move: misconception ? "build" : "challenge",
        verdicts: [],
      }),
      schema: chatCheckOutputSchema,
      }),
    );
    result.verdict = check.verdict;
    result.hinted = Boolean(check.hint);
    result.text = { question: probe, feedback: check.feedback, hint: check.hint };
    if (check.verdict !== "resolved" && !check.hint) result.skippedHint = true;
    if (check.hint) {
      const judge = async (feedback: string | null, hint: string) =>
        (
          await stage("judge", () => generateStructured({
            ...leakCheckPrompt({
              concept,
              misconception,
              question: probe,
              feedback,
              hint,
            }),
            schema: leakCheckOutputSchema,
            model: JUDGE,
          }))
        ).leaks;

      result.rawLeak = await judge(check.feedback, check.hint);

      // What the route does with a hint: the reviewer pass rewrites leaks.
      const guarded = await stage("guard", () =>
        guardAgainstLeak({
          concept,
          misconception,
          question: probe,
          feedback: check.feedback,
          hint: check.hint!,
          misconceptions,
        }),
      );
      const feedback = guarded.feedback ?? check.feedback;
      result.text.guardedFeedback = feedback;
      result.text.guardedHint = guarded.hint;
      result.guardedLeak = await judge(feedback, guarded.hint);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function runAll(): Promise<Result[]> {
  const results: Result[] = new Array(evalCases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < evalCases.length) {
        const i = next++;
        results[i] = await runCase(evalCases[i]);
      }
    }),
  );
  return results;
}

it("diagnoses explanations accurately and never leaks the answer in a first-miss hint", async () => {
  expect(process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY must be set").toBeTruthy();
  if (JUDGE === MODEL) console.warn("[eval] the judge is the same model as the app; leak numbers are weak evidence");

  const started = Date.now();
  const results = await runAll();

  const kinds = ["gap", "strong", "tricky"] as const;
  const lines = results.map(
    (r) =>
      `#${String(r.id).padStart(2)} ${r.conceptId.padEnd(19)} ${r.kind.padEnd(6)} ` +
      `${r.diagnosisOk ? "ok  " : "MISS"} got=${r.got ?? "null"} want=${r.expected.join("|") || "null"}` +
      (r.verdict ? ` verdict=${r.verdict} hint=${r.hinted ? "y" : "n"}` : "") +
      (r.rawLeak !== undefined ? ` raw-leak=${r.rawLeak ? "YES" : "no"} guarded-leak=${r.guardedLeak ? "YES" : "no"}` : "") +
      (r.skippedHint ? " NO-HINT" : "") +
      (r.error ? ` ERROR ${r.error}` : ""),
  );
  const correct = results.filter((r) => r.diagnosisOk).length;
  const byKind = kinds.map((k) => {
    const of = results.filter((r) => r.kind === k);
    return `${k} ${of.filter((r) => r.diagnosisOk).length}/${of.length}`;
  });
  const rawLeaks = results.filter((r) => r.rawLeak).length;
  const leaks = results.filter((r) => r.guardedLeak).length;
  const judged = results.filter((r) => r.rawLeak !== undefined).length;
  const skipped = results.filter((r) => r.skippedHint).length;
  const errors = results.filter((r) => r.error).length;

  const summary = {
    model: MODEL,
    judge: JUDGE,
    diagnosis: `${correct}/${results.length}`,
    byKind,
    rawLeaks: `${rawLeaks}/${judged}`,
    guardedLeaks: `${leaks}/${judged}`,
    skippedHints: skipped,
    errors,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  console.log(`\n${lines.join("\n")}\n\n${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync("evals/last-run.json", JSON.stringify({ summary, results }, null, 2));

  expect(errors, "cases that errored").toBeLessThanOrEqual(MAX_ERRORS);
  expect(correct / results.length, "diagnosis accuracy").toBeGreaterThanOrEqual(MIN_ACCURACY);
  expect(leaks, "first-miss hints that still leak the answer after the guard").toBeLessThanOrEqual(MAX_LEAKS);
  expect(skipped, "first misses that got no hint").toBeLessThanOrEqual(MAX_SKIPPED_HINTS);
});

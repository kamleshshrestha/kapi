import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { z } from "zod";
import { getConcept } from "@/lib/learning/concepts";
import { getMisconceptionsForConcept } from "@/lib/learning/misconceptions";
import { TEACH_TURNS } from "@/lib/learning/v2/chatFlow";
import { MODEL, generateStructured } from "@/lib/llm/client";
import { chatTeachPrompt } from "@/lib/llm/prompts";
import { chatTeachOutputSchema } from "@/lib/llm/schemas";
import { teachCases, type TeachCase, type TeachVerdict } from "./teachCases";

/**
 * Runs the real teach-it-back prompt (chatTeachPrompt, the production code)
 * against the real model on the scripted conversations in teachCases.ts:
 * - verdict: does the assessment on the last turn match the hand label? The
 *   error that matters most is a "false solid" (a partial or shaky
 *   explanation rated solid), because a solid verdict is counted as clean
 *   Defend evidence. Rating too harshly is the milder error.
 * - gaps: a solid verdict must list no gaps, a partial or shaky one at least one.
 * - role: the beginner must never teach, correct, hint or say what is true,
 *   and must ask exactly one new question per turn (none on the last). Judged
 *   by a DIFFERENT model (EVAL_JUDGE_MODEL) on all three replies of every case;
 *   the judge counts questions because a restatement phrased as a question
 *   ("so it just does X?") is not one, which a plain "?" count gets wrong.
 *
 * Thresholds (env): EVAL_TEACH_MIN_ACCURACY (default 0.75), EVAL_TEACH_MAX_FALSE_SOLID (0),
 * EVAL_TEACH_MAX_ROLE_BREAKS (2), EVAL_TEACH_MAX_SHAPE (7: gaps and question
 * count mistakes together; the judge-counted question mistakes were 4 and 5 in two runs, with different replies flagged each time), EVAL_MAX_ERRORS (1). A tripwire, not a precise
 * measure: 12 cases and an LLM judge. Results go to evals/last-teach-run.json.
 */
const JUDGE = process.env.EVAL_JUDGE_MODEL ?? "openai/gpt-oss-120b";
const MIN_ACCURACY = Number(process.env.EVAL_TEACH_MIN_ACCURACY ?? "0.75");
const MAX_FALSE_SOLID = Number(process.env.EVAL_TEACH_MAX_FALSE_SOLID ?? "0");
const MAX_ROLE_BREAKS = Number(process.env.EVAL_TEACH_MAX_ROLE_BREAKS ?? "2");
const MAX_SHAPE = Number(process.env.EVAL_TEACH_MAX_SHAPE ?? "7");
const MAX_ERRORS = Number(process.env.EVAL_MAX_ERRORS ?? "1");
const CONCURRENCY = 4;

const roleCheckSchema = z.object({
  breaksRole: z.boolean(),
  reason: z.string(),
  /** Genuinely new questions the beginner asks, not counting a restatement phrased as a question. */
  newQuestions: z.number().int().min(0).max(5),
});

type Result = {
  id: number;
  conceptId: string;
  expected: TeachVerdict;
  got: TeachVerdict | null;
  verdictOk: boolean;
  falseSolid: boolean;
  gapsOk?: boolean;
  /** Beginner replies the judge says teach, correct or hint. */
  roleBreaks: number[];
  /** Turns whose reply has the wrong number of questions (last: 0, others: 1). */
  questionMisses: number[];
  replies?: string[];
  assessment?: { clear: string[]; gaps: string[] };
  error?: string;
};

function opener(title: string): { role: "kapi"; text: string } {
  return {
    role: "kapi",
    text: `Okay, pretend I'm a total beginner and I've never heard of ${title}. Can you explain it to me?`,
  };
}

async function stage<T>(name: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new Error(`[${name}] ${error instanceof Error ? error.message : String(error)}`);
  }
}

function roleJudgePrompt(args: { title: string; learner: string; reply: string; last: boolean }) {
  return {
    system: `You are a strict reviewer of one message from "Kapi", who is playing a curious complete beginner while a learner explains ${args.title} to it. The beginner must NOT act as a tutor. It breaks its role if it does any of these:
- states a fact about ${args.title} that the learner did not just say (adds information),
- says or implies that the learner is right or wrong, or corrects them,
- hints at what the true answer is, for example through a leading question ("isn't it because...?", "but doesn't it...?"),
- explains or teaches anything.
It does NOT break its role by restating what the learner said in simpler words, by showing curiosity or confusion, by asking a naive open question, or by thanking the learner${args.last ? " (this is the last turn, so a short thank-you is expected)" : ""}.
Set "breaksRole" to true only when it clearly does one of the first four things, and say which in "reason", in one short sentence.

Also set "newQuestions" to the number of separate things the beginner asks that the learner has not answered yet. Repeating the learner's point back with a question mark ("so it just does X?") is a restatement, not a new question, and does not count.`,
    user: `<learner_message>
${args.learner}
</learner_message>

<beginner_reply>
${args.reply}
</beginner_reply>`,
  };
}

async function runCase(c: TeachCase): Promise<Result> {
  const concept = getConcept(c.conceptId)!;
  const misconceptions = getMisconceptionsForConcept(c.conceptId);
  const result: Result = {
    id: c.id,
    conceptId: c.conceptId,
    expected: c.expected,
    got: null,
    verdictOk: false,
    falseSolid: false,
    roleBreaks: [],
    questionMisses: [],
  };
  try {
    const history = [opener(concept.title)] as { role: "kapi" | "learner"; text: string }[];
    const replies: string[] = [];
    let assessment: { verdict: TeachVerdict; clear: string[]; gaps: string[] } | null = null;

    for (let turn = 1; turn <= TEACH_TURNS; turn++) {
      const message = c.learner[turn - 1];
      const out = await stage(`teach turn ${turn}`, () =>
        generateStructured({
          ...chatTeachPrompt({
            concept,
            misconceptions,
            history: [...history],
            explanation: message,
            turn,
            maxTurns: TEACH_TURNS,
          }),
          schema: chatTeachOutputSchema,
        }),
      );
      replies.push(out.reply);
      const last = turn === TEACH_TURNS;
      if (last) assessment = out.assessment;
      else history.push({ role: "learner", text: message }, { role: "kapi", text: c.beginner[turn - 1] });

      const verdict = await stage(`role judge turn ${turn}`, () =>
        generateStructured({
          ...roleJudgePrompt({ title: concept.title, learner: message, reply: out.reply, last }),
          schema: roleCheckSchema,
          model: JUDGE,
        }),
      );
      if (verdict.breaksRole) result.roleBreaks.push(turn);
      if (verdict.newQuestions !== (last ? 0 : 1)) result.questionMisses.push(turn);
    }

    result.replies = replies;
    result.got = assessment!.verdict;
    result.verdictOk = result.got === c.expected;
    result.falseSolid = result.got === "solid" && c.expected !== "solid";
    result.gapsOk = result.got === "solid" ? assessment!.gaps.length === 0 : assessment!.gaps.length > 0;
    result.assessment = { clear: assessment!.clear, gaps: assessment!.gaps };
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function runAll(): Promise<Result[]> {
  const results: Result[] = new Array(teachCases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < teachCases.length) {
        const i = next++;
        results[i] = await runCase(teachCases[i]);
      }
    }),
  );
  return results;
}

it("assesses teach-it-back explanations accurately, never credits a wrong one as solid, and keeps the beginner in role", async () => {
  expect(process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY must be set").toBeTruthy();
  if (JUDGE === MODEL) console.warn("[eval] the judge is the same model as the app; role numbers are weak evidence");

  const started = Date.now();
  const results = await runAll();
  const done = results.filter((r) => !r.error);

  const lines = results.map(
    (r) =>
      `#${String(r.id).padStart(2)} ${r.conceptId.padEnd(19)} want=${r.expected.padEnd(7)} got=${(r.got ?? "-").padEnd(7)} ` +
      `${r.verdictOk ? "ok  " : r.falseSolid ? "FALSE-SOLID" : "MISS"}` +
      (r.gapsOk === false ? " gaps-wrong" : "") +
      (r.roleBreaks.length ? ` role-break@${r.roleBreaks.join(",")}` : "") +
      (r.questionMisses.length ? ` questions@${r.questionMisses.join(",")}` : "") +
      (r.error ? ` ERROR ${r.error}` : ""),
  );
  const correct = done.filter((r) => r.verdictOk).length;
  const falseSolid = done.filter((r) => r.falseSolid).length;
  const tooHarsh = done.filter((r) => r.expected === "solid" && r.got !== "solid").length;
  const roleBreaks = done.reduce((n, r) => n + r.roleBreaks.length, 0);
  const shape = done.filter((r) => r.gapsOk === false).length + done.reduce((n, r) => n + r.questionMisses.length, 0);
  const errors = results.length - done.length;

  const summary = {
    model: MODEL,
    judge: JUDGE,
    verdicts: `${correct}/${results.length}`,
    falseSolid,
    solidRatedLower: tooHarsh,
    roleBreaks: `${roleBreaks}/${done.length * TEACH_TURNS}`,
    shapeMistakes: shape,
    errors,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  console.log(`\n${lines.join("\n")}\n\n${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync("evals/last-teach-run.json", JSON.stringify({ summary, results }, null, 2));

  expect(errors, "cases that errored").toBeLessThanOrEqual(MAX_ERRORS);
  expect(correct / results.length, "verdict accuracy").toBeGreaterThanOrEqual(MIN_ACCURACY);
  expect(falseSolid, "wrong explanations rated solid").toBeLessThanOrEqual(MAX_FALSE_SOLID);
  expect(roleBreaks, "beginner replies that teach, correct or hint").toBeLessThanOrEqual(MAX_ROLE_BREAKS);
  expect(shape, "gaps or question-count mistakes").toBeLessThanOrEqual(MAX_SHAPE);
});

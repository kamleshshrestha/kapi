"use client";

import { useEffect, useRef, useState } from "react";
import { getMisconception } from "@/lib/learning/misconceptions";
import { pickOpener, welcomeBackOpener } from "@/lib/learning/v2/openers";
import { GATE_ASK_PROMPT, GATE_ACTIONS, pickGateLine } from "@/lib/learning/v2/gate";
import type { GateKind } from "@/lib/learning/v2/gate";
import { readLastSession, writeLastSession } from "@/lib/learning/v2/localSession";
import { postJson } from "@/lib/learning/v2/api";
import { evidenceFor, levelForMove } from "@/lib/learning/v2/levels";
import { recordEvidence } from "@/lib/learning/v2/levelStore";
import {
  saveAnsweredCard,
  savePersonalCard,
  saveRevisitCards,
} from "@/lib/learning/v2/personalCards";
import { CHAT_HISTORY_LIMIT, MAX_CHAT_TURNS } from "@/lib/learning/v2/chatFlow";
import type { ChatMessage, ChatSessionPhase } from "@/lib/learning/v2/types";
import type { ChatMove } from "@/lib/llm/schemas";

/** Below this, there isn't enough to diagnose from — skip the LLM call. */
const THIN_EXPLANATION_MIN_LENGTH = 15;

/** One chat message from several pieces: blank-separated paragraphs, empty pieces dropped. */
function paragraphs(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join("\n\n");
}

type DiagnoseResponse = {
  misconceptionId: string | null;
  reasoning: string;
  explanation: string | null;
  example: string | null;
  takeaway: string | null;
  /** A standard formula to show beside the explanation, when one helps. */
  formula: string | null;
  probeQuestion: string | null;
};

type Verdict = "resolved" | "partial" | "unresolved";

type CheckResponse =
  | {
      intent: "answer";
      verdict: Verdict;
      feedback: string;
      hint: string | null;
      /** A small piece of teaching that comes before a "build" question. */
      teaching: string | null;
      nextMove: ChatMove | null;
      nextProbeQuestion: string | null;
    }
  /**
   * The learner asked a question instead of answering. Kapi answers it and the
   * question it asked stays pending, so nothing about the conversation's
   * progress moves: no verdict, no turn, no card, no depth-level evidence.
   */
  | { intent: "question"; reply: string };

export type AssistKind = "hint" | "lost" | "rephrase";

/** What the learner can ask for instead of answering, with the chat line it shows. */
export const ASSIST_ACTIONS: { kind: AssistKind; label: string }[] = [
  { kind: "hint", label: "Give me a hint" },
  { kind: "lost", label: "I'm lost" },
  { kind: "rephrase", label: "Explain it differently" },
];

type AssistResponse = { reply: string; question: string | null };

export type SessionSummary = {
  understood: string[];
  fixed: string[];
  /** Each shaky idea is also saved as a review flashcard (question/answer). */
  revisit: { idea: string; question: string; answer: string }[];
};

export function useV2ChatSession(
  conceptId: string,
  conceptTitle: string,
  fallbackOptions: string[],
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatSessionPhase>("await-explanation");
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // null misconceptionId while a probe is pending means the learner's first
  // explanation was strong and Kapi is challenging it rather than fixing a gap.
  const [misconceptionId, setMisconceptionId] = useState<string | null>(null);
  const [probeQuestion, setProbeQuestion] = useState<string | null>(null);
  // What the current question is for: a gap starts by building up the learner's
  // understanding, a strong explanation starts with a challenge. The server
  // picks each later step from how the learner is doing.
  const [move, setMove] = useState<ChatMove>("build");
  const [turn, setTurn] = useState(1);
  // 1 on a fresh question, 2 once a hint has been given for it.
  const [attempt, setAttempt] = useState(1);
  // What the checkpoint after Kapi's explanation is holding back until the
  // learner says they are ready: the example and the first question.
  const [pendingReveal, setPendingReveal] = useState<{
    example: string | null;
    takeaway: string | null;
    probeQuestion: string;
  } | null>(null);
  const [cardSaved, setCardSaved] = useState(false);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  /** How many revisit flashcards the recap added to the "From you" deck. */
  const [savedCards, setSavedCards] = useState(0);
  // The last request that failed, ready to re-send without re-typing. It is a
  // closure over the state at the time of the failure, which the failed call
  // left untouched, so replaying it sends exactly what was sent before.
  const [failedAction, setFailedAction] = useState<{ run: () => void } | null>(null);

  // Groups this chat's events in the opt-in log (the server stores nothing
  // unless the learner has opted in). Created on first use, renewed per concept.
  const sessionIdRef = useRef<string | undefined>(undefined);
  // Whether the learner asked for a hint or said they were lost on the current
  // question, which makes a correct answer "helped" rather than clean for the
  // depth levels. Reset whenever a new question is asked.
  const helpedRef = useRef(false);
  function getSessionId() {
    return (sessionIdRef.current ??= crypto.randomUUID());
  }

  // Instant opener: reads localStorage and picks/templates a cached line.
  // No API call, so there is nothing to wait on before this appears.
  useEffect(() => {
    sessionIdRef.current = undefined;
    helpedRef.current = false;
    const last = readLastSession(conceptId);
    const opener = last
      ? welcomeBackOpener(conceptTitle, last)
      : pickOpener(conceptTitle);
    // Reads localStorage and Math.random(), neither available during SSR, so
    // this cannot be computed during render — it has to run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([{ role: "kapi", text: opener }]);
  }, [conceptId, conceptTitle]);

  function append(role: ChatMessage["role"], text: string, kind?: ChatMessage["kind"]) {
    setMessages((m) => [...m, { role, text, ...(kind ? { kind } : {}) }]);
  }

  async function submitExplanation(text: string, retrying = false) {
    if (!retrying) append("learner", text);

    if (text.trim().length < THIN_EXPLANATION_MIN_LENGTH) {
      append("kapi", "No worries — pick whichever sounds closest, or say a bit more.");
      setQuickReplies(fallbackOptions);
      return;
    }

    setQuickReplies(null);
    setPending(true);
    setError(null);
    try {
      const result = await postJson<DiagnoseResponse>("/api/v2/chat", {
        conceptId,
        phase: "diagnose",
        explanation: text,
        sessionId: getSessionId(),
      });

      // The reaction and the fix come first and on their own. A learner told us
      // the opening arrived as one long text, so the example and the question
      // wait behind a checkpoint instead of landing in the same breath.
      append("kapi", [result.reasoning, result.explanation].filter(Boolean).join(" "));
      // Right after the words that introduced it, before the checkpoint.
      if (result.formula) append("kapi", result.formula, "formula");

      // No gap found: a strong first explanation is evidence for "explain".
      if (result.misconceptionId === null) recordEvidence(conceptId, "explain", "clean");

      // No question to ask (model had nothing to probe): the chat is over.
      if (!result.probeQuestion) {
        setPhase("done");
        return;
      }

      // Record the gap right away, so it is remembered even if the learner
      // leaves mid-conversation; resolving it later flips this to resolved.
      if (result.misconceptionId) {
        writeLastSession(conceptId, {
          misconceptionId: result.misconceptionId,
          misconceptionTitle:
            getMisconception(result.misconceptionId)?.title ?? "this",
          resolved: false,
          at: new Date().toISOString(),
        });
      }

      setMisconceptionId(result.misconceptionId);
      setMove(result.misconceptionId ? "build" : "challenge");
      setTurn(1);
      setAttempt(1);

      // A strong explanation was not taught anything, so there is nothing to
      // check understanding of: the challenge follows straight away.
      const taught = Boolean(result.explanation || result.example || result.takeaway);
      if (!taught) {
        append("kapi", result.probeQuestion);
        setProbeQuestion(result.probeQuestion);
        setPhase("await-check-answer");
        return;
      }

      append("kapi", pickGateLine());
      setPendingReveal({
        example: result.example,
        takeaway: result.takeaway,
        probeQuestion: result.probeQuestion,
      });
      setPhase("await-gate");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setFailedAction({ run: () => void submitExplanation(text, true) });
    } finally {
      setPending(false);
    }
  }

  /** The learner is ready: the example and the first question follow. */
  function revealQuestion() {
    if (!pendingReveal) return;
    const { example, takeaway, probeQuestion } = pendingReveal;
    const teaching = [example, takeaway].filter(Boolean).join(" ");
    if (teaching) append("kapi", teaching);
    append("kapi", probeQuestion);
    setProbeQuestion(probeQuestion);
    setPendingReveal(null);
    setPhase("await-check-answer");
  }

  /**
   * A question asked at the checkpoint, where Kapi has asked nothing yet. No
   * classification is needed (the learner is not answering anything) and the
   * checkpoint stays open, so they can ask again or move on when ready.
   */
  async function askAtGate(text: string, retrying = false) {
    const history = messages.slice(-CHAT_HISTORY_LIMIT);
    if (!retrying) append("learner", text);
    setPending(true);
    setError(null);
    try {
      const result = await postJson<{ reply: string }>("/api/v2/chat", {
        conceptId,
        phase: "question",
        sessionId: getSessionId(),
        misconceptionId,
        probeQuestion: null,
        learnerQuestion: text,
        history,
      });
      append("kapi", result.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setFailedAction({ run: () => void askAtGate(text, true) });
    } finally {
      setPending(false);
    }
  }

  /** The checkpoint chips: ready to go on, or a question first. */
  function gate(kind: GateKind) {
    if (pending || phase !== "await-gate") return;
    setFailedAction(null);
    append("learner", GATE_ACTIONS.find((a) => a.kind === kind)?.label ?? kind);
    if (kind === "ready") {
      revealQuestion();
      return;
    }
    append("kapi", GATE_ASK_PROMPT);
  }

  /** Best-effort recap: a failure just means no recap card, never an error. */
  async function requestSummary(transcript: ChatMessage[], allVerdicts: Verdict[]) {
    setSummarizing(true);
    try {
      const recap = await postJson<SessionSummary>("/api/v2/chat", {
        conceptId,
        phase: "summary",
        misconceptionId,
        history: transcript.slice(-30),
        verdicts: allVerdicts,
      });
      setSummary(recap);
      const cards = recap.revisit
        .map((r) => ({ front: r.question.trim(), back: r.answer.trim() }))
        .filter((c) => c.front && c.back);
      if (cards.length > 0) saveRevisitCards(conceptId, cards);
      setSavedCards(cards.length);
    } catch {
      // The conversation itself is complete; the recap is a bonus.
    } finally {
      setSummarizing(false);
    }
  }

  async function submitCheckAnswer(text: string, retrying = false) {
    if (!probeQuestion) return;
    // `messages` is the conversation before this answer, which is sent
    // separately, so the model sees the thread leading up to it.
    const history = messages.slice(-CHAT_HISTORY_LIMIT);
    if (!retrying) append("learner", text);
    setPending(true);
    setError(null);
    try {
      const result = await postJson<CheckResponse>("/api/v2/chat", {
        conceptId,
        phase: "check",
        sessionId: getSessionId(),
        misconceptionId,
        probeQuestion,
        answer: text,
        history,
        turn,
        attempt,
        move,
        verdicts,
      });
      // A question, not an answer: reply and leave the question standing.
      // Both messages stay in `messages`, so the next turn's history carries
      // them and Kapi picks the thread up where the learner left it.
      if (result.intent === "question") {
        append("kapi", result.reply);
        return;
      }

      const resolved = result.verdict === "resolved";

      // First miss: nudge instead of revealing, and let them retry this question.
      if (result.hint && !resolved && attempt === 1) {
        append("kapi", result.feedback);
        append("kapi", result.hint);
        setAttempt(2);
        return;
      }

      const allVerdicts = [...verdicts, result.verdict];
      setVerdicts(allVerdicts);

      // What this answer shows, for the depth levels (a correct answer only).
      const evidence = evidenceFor({
        verdict: result.verdict,
        attempt,
        helpUsed: helpedRef.current,
      });
      if (evidence) recordEvidence(conceptId, levelForMove(move), evidence);

      // Every question answered correctly becomes a card (if it isn't one
      // already). The first one on the diagnosed gap is that gap's card, and
      // resolving the gap closes it in the session record.
      let everResolved = cardSaved;
      if (resolved) {
        if (misconceptionId && !cardSaved) {
          savePersonalCard(conceptId, {
            misconceptionId,
            front: probeQuestion,
            back: result.feedback,
          });
          writeLastSession(conceptId, {
            misconceptionId,
            misconceptionTitle: getMisconception(misconceptionId)?.title ?? "this",
            resolved: true,
            at: new Date().toISOString(),
          });
          setCardSaved(true);
          everResolved = true;
        } else {
          saveAnsweredCard(conceptId, {
            front: probeQuestion,
            back: result.feedback,
          });
        }
      }

      const next = turn >= MAX_CHAT_TURNS ? null : result.nextProbeQuestion;
      if (next) {
        append("kapi", result.feedback);
        if (result.teaching) append("kapi", result.teaching);
        append("kapi", next);
        setProbeQuestion(next);
        setMove(result.nextMove ?? "check");
        setTurn((t) => t + 1);
        setAttempt(1);
        helpedRef.current = false;
        return;
      }

      // Wrapping up. Only a session that started from a gap is remembered for
      // the welcome-back opener and only a still-open gap gets the "come back".
      let closing: string | null = null;
      if (misconceptionId) {
        if (!everResolved) {
          closing =
            "No worries — let's come back to this one later. You can review it anytime from your flashcards.";
        }
        writeLastSession(conceptId, {
          misconceptionId,
          misconceptionTitle: getMisconception(misconceptionId)?.title ?? "this",
          resolved: everResolved,
          at: new Date().toISOString(),
        });
      }
      const wrapUp = paragraphs(result.feedback, closing);
      append("kapi", wrapUp);
      setPhase("done");
      void requestSummary(
        [...messages, { role: "learner", text }, { role: "kapi", text: wrapUp }],
        allVerdicts,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setFailedAction({ run: () => void submitCheckAnswer(text, true) });
    } finally {
      setPending(false);
    }
  }

  /** Asking for help instead of answering; never advances the question count. */
  async function assist(kind: AssistKind, retrying = false) {
    if (!probeQuestion || pending || phase !== "await-check-answer") return;
    const history = messages.slice(-CHAT_HISTORY_LIMIT);
    const label = ASSIST_ACTIONS.find((a) => a.kind === kind)?.label ?? kind;
    // Asking to rephrase is not help with the answer; a hint or "I'm lost" is.
    if (kind === "hint" || kind === "lost") helpedRef.current = true;
    if (!retrying) {
      setFailedAction(null);
      append("learner", label);
    }
    setPending(true);
    setError(null);
    try {
      const result = await postJson<AssistResponse>("/api/v2/chat", {
        conceptId,
        phase: "assist",
        kind,
        misconceptionId,
        probeQuestion,
        history,
      });
      append("kapi", result.reply);
      if (result.question) append("kapi", result.question);
      if (result.question) {
        setProbeQuestion(result.question);
        setMove("build");
        setAttempt(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setFailedAction({ run: () => void assist(kind, true) });
    } finally {
      setPending(false);
    }
  }

  /** Re-sends the request that just failed, without the learner retyping it. */
  function retry() {
    if (!failedAction || pending) return;
    const { run } = failedAction;
    setFailedAction(null);
    run();
  }

  function submit(text: string) {
    if (!text.trim() || pending || phase === "done") return;
    setFailedAction(null);
    if (phase === "await-explanation") void submitExplanation(text);
    else if (phase === "await-gate") void askAtGate(text);
    else if (phase === "await-check-answer") void submitCheckAnswer(text);
  }

  return {
    messages,
    phase,
    quickReplies,
    pending,
    error,
    submit,
    assist,
    gate,
    retry,
    canRetry: failedAction !== null && !pending,
    summary,
    summarizing,
    savedCards,
  };
}

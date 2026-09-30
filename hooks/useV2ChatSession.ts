"use client";

import { useEffect, useState } from "react";
import { getMisconception } from "@/lib/learning/misconceptions";
import { pickOpener, welcomeBackOpener } from "@/lib/learning/v2/openers";
import { readLastSession, writeLastSession } from "@/lib/learning/v2/localSession";
import { savePersonalCard, saveRevisitCards } from "@/lib/learning/v2/personalCards";
import { CHAT_HISTORY_LIMIT, MAX_CHAT_TURNS } from "@/lib/learning/v2/chatFlow";
import type { ChatMessage, ChatSessionPhase } from "@/lib/learning/v2/types";

/** Below this, there isn't enough to diagnose from — skip the LLM call. */
const THIN_EXPLANATION_MIN_LENGTH = 15;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}

type DiagnoseResponse = {
  misconceptionId: string | null;
  reasoning: string;
  explanation: string | null;
  example: string | null;
  takeaway: string | null;
  probeQuestion: string | null;
};

type Verdict = "resolved" | "partial" | "unresolved";

type CheckResponse = {
  verdict: Verdict;
  feedback: string;
  hint: string | null;
  nextProbeQuestion: string | null;
};

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
  const [turn, setTurn] = useState(1);
  // 1 on a fresh question, 2 once a hint has been given for it.
  const [attempt, setAttempt] = useState(1);
  const [cardSaved, setCardSaved] = useState(false);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  /** How many revisit flashcards the recap added to the "From you" deck. */
  const [savedCards, setSavedCards] = useState(0);
  // Instant opener: reads localStorage and picks/templates a cached line.
  // No API call, so there is nothing to wait on before this appears.
  useEffect(() => {
    const last = readLastSession(conceptId);
    const opener = last
      ? welcomeBackOpener(conceptTitle, last)
      : pickOpener(conceptTitle);
    // Reads localStorage and Math.random(), neither available during SSR, so
    // this cannot be computed during render — it has to run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([{ role: "kapi", text: opener }]);
  }, [conceptId, conceptTitle]);

  function append(role: ChatMessage["role"], text: string) {
    setMessages((m) => [...m, { role, text }]);
  }

  async function submitExplanation(text: string) {
    append("learner", text);

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
      });

      append("kapi", [result.reasoning, result.explanation].filter(Boolean).join(" "));
      if (result.example || result.takeaway) {
        append("kapi", [result.example, result.takeaway].filter(Boolean).join(" "));
      }
      if (result.probeQuestion) append("kapi", result.probeQuestion);

      // No question to ask (model had nothing to probe): the chat is over.
      if (!result.probeQuestion) {
        setPhase("done");
        return;
      }

      setMisconceptionId(result.misconceptionId);
      setProbeQuestion(result.probeQuestion);
      setTurn(1);
      setAttempt(1);
      setPhase("await-check-answer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
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

  async function submitCheckAnswer(text: string) {
    if (!probeQuestion) return;
    // `messages` is the conversation before this answer, which is sent
    // separately, so the model sees the thread leading up to it.
    const history = messages.slice(-CHAT_HISTORY_LIMIT);
    append("learner", text);
    setPending(true);
    setError(null);
    try {
      const result = await postJson<CheckResponse>("/api/v2/chat", {
        conceptId,
        phase: "check",
        misconceptionId,
        probeQuestion,
        answer: text,
        history,
        turn,
        attempt,
      });
      append("kapi", result.feedback);

      const resolved = result.verdict === "resolved";

      // First miss: nudge instead of revealing, and let them retry this question.
      if (result.hint && !resolved && attempt === 1) {
        append("kapi", result.hint);
        setAttempt(2);
        return;
      }

      const allVerdicts = [...verdicts, result.verdict];
      setVerdicts(allVerdicts);

      let everResolved = cardSaved;
      if (resolved && misconceptionId && !cardSaved) {
        savePersonalCard(conceptId, {
          misconceptionId,
          front: probeQuestion,
          back: result.feedback,
        });
        setCardSaved(true);
        everResolved = true;
      }

      const next = turn >= MAX_CHAT_TURNS ? null : result.nextProbeQuestion;
      if (next) {
        append("kapi", next);
        setProbeQuestion(next);
        setTurn((t) => t + 1);
        setAttempt(1);
        return;
      }

      // Wrapping up. Only a session that started from a gap is remembered for
      // the welcome-back opener and only a still-open gap gets the "come back".
      let closing: ChatMessage[] = [];
      if (misconceptionId) {
        if (!everResolved) {
          const text =
            "No worries — let's come back to this one later. You can review it anytime from your flashcards.";
          append("kapi", text);
          closing = [{ role: "kapi", text }];
        }
        writeLastSession(conceptId, {
          misconceptionId,
          misconceptionTitle: getMisconception(misconceptionId)?.title ?? "this",
          resolved: everResolved,
          at: new Date().toISOString(),
        });
      }
      setPhase("done");
      void requestSummary(
        [
          ...messages,
          { role: "learner", text },
          { role: "kapi", text: result.feedback },
          ...closing,
        ],
        allVerdicts,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  /** Asking for help instead of answering; never advances the question count. */
  async function assist(kind: AssistKind) {
    if (!probeQuestion || pending || phase !== "await-check-answer") return;
    const history = messages.slice(-CHAT_HISTORY_LIMIT);
    const label = ASSIST_ACTIONS.find((a) => a.kind === kind)?.label ?? kind;
    append("learner", label);
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
      if (result.question) {
        append("kapi", result.question);
        setProbeQuestion(result.question);
        setAttempt(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  function submit(text: string) {
    if (!text.trim() || pending || phase === "done") return;
    if (phase === "await-explanation") void submitExplanation(text);
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
    summary,
    summarizing,
    savedCards,
  };
}

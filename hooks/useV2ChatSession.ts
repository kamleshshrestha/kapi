"use client";

import { useEffect, useState } from "react";
import { getMisconception } from "@/lib/learning/misconceptions";
import { pickOpener, welcomeBackOpener } from "@/lib/learning/v2/openers";
import { readLastSession, writeLastSession } from "@/lib/learning/v2/localSession";
import { savePersonalCard } from "@/lib/learning/v2/personalCards";
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

type CheckResponse = {
  verdict: "resolved" | "partial" | "unresolved";
  feedback: string;
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

  const [misconceptionId, setMisconceptionId] = useState<string | null>(null);
  const [probeQuestion, setProbeQuestion] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);

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

      if (!result.misconceptionId) {
        append("kapi", result.reasoning);
        setPhase("done");
        return;
      }

      append("kapi", [result.reasoning, result.explanation].filter(Boolean).join(" "));
      if (result.example || result.takeaway) {
        append("kapi", [result.example, result.takeaway].filter(Boolean).join(" "));
      }
      if (result.probeQuestion) append("kapi", result.probeQuestion);

      setMisconceptionId(result.misconceptionId);
      setProbeQuestion(result.probeQuestion);
      setAttempt(1);
      setPhase("await-check-answer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function submitCheckAnswer(text: string) {
    if (!misconceptionId || !probeQuestion) return;
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
      });
      append("kapi", result.feedback);

      const title = getMisconception(misconceptionId)?.title ?? "this";
      const resolved = result.verdict === "resolved";

      if (resolved) {
        savePersonalCard(conceptId, {
          misconceptionId,
          front: probeQuestion,
          back: result.feedback,
        });
      }

      if (resolved || attempt >= 2) {
        if (!resolved) {
          append(
            "kapi",
            "No worries — let's come back to this one later. You can review it anytime from your flashcards.",
          );
        }
        writeLastSession(conceptId, {
          misconceptionId,
          misconceptionTitle: title,
          resolved,
          at: new Date().toISOString(),
        });
        setPhase("done");
        return;
      }

      setAttempt((a) => a + 1);
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

  return { messages, phase, quickReplies, pending, error, submit };
}

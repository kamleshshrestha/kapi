"use client";

import { useState } from "react";
import { postJson } from "@/lib/learning/v2/api";
import { TEACH_TURNS } from "@/lib/learning/v2/chatFlow";
import { recordEvidence } from "@/lib/learning/v2/levelStore";
import type { ChatMessage } from "@/lib/learning/v2/types";

export type TeachVerdict = "solid" | "partial" | "shaky";
export type TeachAssessment = { verdict: TeachVerdict; clear: string[]; gaps: string[] };

type TeachResponse = { reply: string; done: boolean; assessment: TeachAssessment | null };

/**
 * Teach-it-back: the learner explains a concept to Kapi playing a beginner
 * (TEACH_TURNS messages). Only a "solid" assessment is evidence, and it counts
 * for the Defend level: defending your understanding against naive questions.
 */
export function useTeachBackSession(conceptId: string, conceptTitle: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "kapi",
      text: `Okay, pretend I'm a total beginner and I've never heard of ${conceptTitle}. Can you explain it to me?`,
    },
  ]);
  const [turn, setTurn] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [assessment, setAssessment] = useState<TeachAssessment | null>(null);
  // The request that failed, kept so a retry re-sends exactly the same thing.
  const [failed, setFailed] = useState<{ text: string; history: ChatMessage[] } | null>(null);

  async function send(text: string, history: ChatMessage[]) {
    setPending(true);
    setError(null);
    setFailed(null);
    try {
      const result = await postJson<TeachResponse>("/api/v2/chat", {
        conceptId,
        phase: "teach",
        history,
        explanation: text,
        turn,
      });
      setMessages((m) => [...m, { role: "kapi", text: result.reply }]);
      if (result.done) {
        setDone(true);
        setAssessment(result.assessment);
        if (result.assessment?.verdict === "solid") {
          recordEvidence(conceptId, "defend", "clean");
        }
      } else {
        setTurn((t) => t + 1);
      }
    } catch (e) {
      setFailed({ text, history });
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || done) return;
    const history = messages;
    setMessages((m) => [...m, { role: "learner", text: trimmed }]);
    void send(trimmed, history);
  }

  function retry() {
    if (!failed || pending) return;
    void send(failed.text, failed.history);
  }

  return {
    messages,
    turn,
    maxTurns: TEACH_TURNS,
    pending,
    error,
    canRetry: failed !== null,
    done,
    assessment,
    submit,
    retry,
  };
}

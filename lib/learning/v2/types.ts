export type ChatRole = "kapi" | "learner";

export type ChatMessage = {
  role: ChatRole;
  text: string;
};

export type ChatSessionPhase =
  | "await-explanation"
  /** Kapi has explained the gap and is waiting to hear whether that landed. */
  | "await-gate"
  | "await-check-answer"
  | "done";

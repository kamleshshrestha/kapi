export type ChatRole = "kapi" | "learner";

export type ChatMessage = {
  role: ChatRole;
  text: string;
};

export type ChatSessionPhase =
  | "await-explanation"
  | "await-check-answer"
  | "done";

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useV2ChatSession", () => ({
  useV2ChatSession: () => session.current,
  ASSIST_ACTIONS: [
    { kind: "hint", label: "Give me a hint" },
    { kind: "lost", label: "I'm lost" },
    { kind: "rephrase", label: "Explain it differently" },
  ],
}));

import ChatThread from "@/components/v2/ChatThread";

afterEach(cleanup);

function renderThread(overrides: Record<string, unknown> = {}) {
  const submit = vi.fn();
  const assist = vi.fn();
  const retry = vi.fn();
  session.current = {
    messages: [{ role: "kapi", text: "Hey there" }],
    phase: "await-explanation",
    quickReplies: null,
    pending: false,
    error: null,
    submit,
    assist,
    retry,
    canRetry: false,
    summary: null,
    summarizing: false,
    savedCards: 0,
    ...overrides,
  };
  render(<ChatThread conceptId="overfitting" conceptTitle="Overfitting" fallbackOptions={[]} />);
  return { submit, assist, retry };
}

describe("ChatThread", () => {
  it("renders every message in the session", () => {
    renderThread({
      messages: [
        { role: "kapi", text: "Hey there" },
        { role: "learner", text: "My explanation" },
      ],
    });

    expect(screen.getByText("Hey there")).toBeInTheDocument();
    expect(screen.getByText("My explanation")).toBeInTheDocument();
  });

  it("shows the typing indicator only while pending", () => {
    renderThread({ pending: true });
    expect(screen.getAllByText("Kapi is typing…").length).toBeGreaterThan(0);
  });

  it("shows errors as an alert", () => {
    renderThread({ error: "Something broke" });
    expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
  });

  it("submits a picked quick reply through the session", () => {
    const { submit } = renderThread({ quickReplies: ["It memorises"] });

    fireEvent.click(screen.getByRole("button", { name: "It memorises" }));

    expect(submit).toHaveBeenCalledExactlyOnceWith("It memorises");
  });

  it("swaps the input bar for a link to try another concept when done", () => {
    renderThread({ phase: "done" });

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: "Try another concept" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("offers help chips while a question is waiting, and routes them to assist", () => {
    const { assist } = renderThread({ phase: "await-check-answer" });

    fireEvent.click(screen.getByRole("button", { name: "I'm lost" }));

    expect(assist).toHaveBeenCalledExactlyOnceWith("lost");
  });

  it("does not offer help chips before the first question or after the chat ends", () => {
    renderThread({ phase: "await-explanation" });
    expect(screen.queryByRole("button", { name: "Give me a hint" })).toBeNull();
    cleanup();

    renderThread({ phase: "done" });
    expect(screen.queryByRole("button", { name: "Give me a hint" })).toBeNull();
  });

  it("disables the help chips while Kapi is replying", () => {
    renderThread({ phase: "await-check-answer", pending: true });
    expect(screen.getByRole("button", { name: "Give me a hint" })).toBeDisabled();
  });

  it("shows a recap once the chat is done, and a wait message while it loads", () => {
    renderThread({ phase: "done", summarizing: true });
    expect(screen.getByText("Kapi is putting together your recap…")).toBeInTheDocument();
    cleanup();

    renderThread({
      phase: "done",
      savedCards: 2,
      summary: { understood: ["Test score matters."], fixed: [], revisit: [] },
    });
    expect(screen.getByRole("region", { name: "Session recap" })).toHaveTextContent(
      "Test score matters.",
    );
    expect(screen.getByRole("link", { name: "Review them" })).toHaveAttribute(
      "href",
      "/decks/overfitting",
    );
  });

  it("offers a refresh button beside an error that can be retried", () => {
    const { retry } = renderThread({
      error: "The AI service failed to respond. Please try again.",
      canRetry: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("The AI service failed to respond.");
  });

  it("hides the refresh button when there is nothing to retry", () => {
    renderThread({ error: "Something broke", canRetry: false });
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

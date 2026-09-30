// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useV2ChatSession", () => ({
  useV2ChatSession: () => session.current,
}));

import ChatThread from "@/components/v2/ChatThread";

afterEach(cleanup);

function renderThread(overrides: Record<string, unknown> = {}) {
  const submit = vi.fn();
  session.current = {
    messages: [{ role: "kapi", text: "Hey there" }],
    phase: "await-explanation",
    quickReplies: null,
    pending: false,
    error: null,
    submit,
    ...overrides,
  };
  render(<ChatThread conceptId="overfitting" conceptTitle="Overfitting" fallbackOptions={[]} />);
  return { submit };
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
      "/v2",
    );
  });
});

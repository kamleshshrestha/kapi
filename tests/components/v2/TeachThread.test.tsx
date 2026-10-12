// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/hooks/useTeachBackSession", () => ({ useTeachBackSession: () => session.current }));

import TeachThread from "@/components/v2/TeachThread";

afterEach(cleanup);

function renderThread(overrides: Record<string, unknown> = {}) {
  session.current = {
    messages: [{ role: "kapi", text: "Explain it to me." }],
    turn: 1,
    maxTurns: 3,
    pending: false,
    error: null,
    canRetry: false,
    done: false,
    assessment: null,
    submit: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
  return render(<TeachThread conceptId="overfitting" conceptTitle="Overfitting" />);
}

describe("TeachThread", () => {
  it("shows the input and which explanation this is while teaching, and no result yet", () => {
    renderThread({ turn: 2 });
    expect(screen.getByPlaceholderText("Type your answer…")).toBeInTheDocument();
    expect(screen.getByText("Your explanation 2 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "How your explanation went" })).toBeNull();
  });

  it("shows the assessment, the levels and next links when done", async () => {
    renderThread({
      done: true,
      assessment: { verdict: "partial", clear: ["It memorises."], gaps: ["Test data shows it."] },
    });
    expect(screen.getByRole("heading", { name: "Mostly there, with a few gaps." })).toBeInTheDocument();
    expect(screen.getByText("It memorises.")).toBeInTheDocument();
    expect(screen.getByText("Test data shows it.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Where you stand on Overfitting" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Type your answer…")).toBeNull();
    expect(screen.getByRole("link", { name: "Practice Overfitting" })).toHaveAttribute("href", "/learn/overfitting");
    expect(screen.getByRole("link", { name: "Try another concept" })).toHaveAttribute("href", "/");
  });

  it("offers a retry after an error", () => {
    renderThread({ error: "Busy", canRetry: true });
    expect(screen.getByRole("alert")).toHaveTextContent("Busy");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

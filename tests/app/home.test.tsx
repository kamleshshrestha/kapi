// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/v2/ConceptSelectorV2", () => ({ default: () => null }));
vi.mock("@/components/v2/SyncNotice", () => ({ default: () => null }));
vi.mock("@/components/v2/EmailAccount", () => ({ default: () => <div data-testid="email-account" /> }));

import V2Home from "@/app/page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("home page intro", () => {
  it("leads with the promise and explains the three steps", () => {
    render(<V2Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "You think you understand it. Kapi finds out if you do." }),
    ).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Explain it");
    expect(steps[2]).toHaveTextContent("Close it");
    expect(screen.getByText(/No sign-up needed/)).toBeInTheDocument();
  });
});

describe("email sign-in", () => {
  it("is hidden unless NEXT_PUBLIC_EMAIL_SIGNIN is on", () => {
    render(<V2Home />);
    expect(screen.queryByTestId("email-account")).not.toBeInTheDocument();
  });

  it("shows when NEXT_PUBLIC_EMAIL_SIGNIN is on", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_SIGNIN", "on");
    render(<V2Home />);
    expect(screen.getByTestId("email-account")).toBeInTheDocument();
  });
});

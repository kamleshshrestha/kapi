// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/v2/ConceptSelectorV2", () => ({ default: () => null }));
vi.mock("@/components/v2/SyncNotice", () => ({ default: () => null }));
vi.mock("@/components/v2/EmailAccount", () => ({ default: () => null }));

import V2Home from "@/app/page";

afterEach(cleanup);

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

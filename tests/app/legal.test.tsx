// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/v2/DataControls", () => ({ default: () => null }));

import ImpressumPage from "@/app/impressum/page";
import PrivacyPage from "@/app/privacy/page";

afterEach(cleanup);

const EMAIL = "kamleshshrestha.work@gmail.com";

describe.each([
  ["impressum", ImpressumPage],
  ["privacy", PrivacyPage],
])("%s page", (_name, Page) => {
  it("names the responsible person with address and a working email link", () => {
    const { container } = render(<Page />);
    expect(container).toHaveTextContent("Kamlesh Shrestha");
    expect(container).toHaveTextContent("13585 Berlin");
    expect(screen.getByRole("link", { name: EMAIL })).toHaveAttribute("href", `mailto:${EMAIL}`);
  });

  it("has no unfilled [placeholder] and no draft banner", () => {
    const { container } = render(<Page />);
    expect(container.textContent).not.toMatch(/\[[^\]]+\]/);
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("privacy page", () => {
  it("explains what the AI service receives, who processes it and the US transfer basis", () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: "What is sent to the AI service" })).toBeInTheDocument();
    expect(container).toHaveTextContent("OpenRouter");
    expect(container).toHaveTextContent("does not send your name, email, account or IP address");
    expect(container).toHaveTextContent("standard contractual clauses");
    expect(screen.getByRole("link", { name: "data processing agreement" })).toHaveAttribute(
      "href",
      "https://openrouter.ai/data-processing-agreement",
    );
  });

  it("says usage is counted as daily totals without identifiers", () => {
    const { container } = render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: "Usage counts" })).toBeInTheDocument();
    expect(container).toHaveTextContent("daily totals");
    expect(container).toHaveTextContent("cannot be traced to you");
  });

  it("names the Berlin data protection authority", () => {
    const { container } = render(<PrivacyPage />);
    expect(container).toHaveTextContent("Berliner Beauftragte für Datenschutz und Informationsfreiheit");
  });
});

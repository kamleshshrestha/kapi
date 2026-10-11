// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SiteFooter from "@/components/v2/SiteFooter";

afterEach(cleanup);

describe("SiteFooter", () => {
  it("links to feedback, privacy and the impressum", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Send feedback" })).toHaveAttribute("href", "/feedback");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum");
  });
});

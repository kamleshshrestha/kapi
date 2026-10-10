// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SyncNotice from "@/components/v2/SyncNotice";
import { isSyncEnabled } from "@/lib/sync/enabled";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("SyncNotice", () => {
  it("renders nothing when Supabase isn't configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { container } = render(<SyncNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks first, and turns sync on only after the learner agrees", () => {
    render(<SyncNotice />);
    expect(screen.getByText(/your own chat messages are not saved/i)).toBeInTheDocument();
    expect(isSyncEnabled()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Save my progress" }));
    expect(isSyncEnabled()).toBe(true);
    expect(screen.getByRole("button", { name: "Turn off" })).toBeInTheDocument();
  });

  it("remembers 'Not now' and offers to opt in later", () => {
    const { unmount } = render(<SyncNotice />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(isSyncEnabled()).toBe(false);
    unmount();

    render(<SyncNotice />);
    expect(screen.queryByRole("button", { name: "Save my progress" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save it to an account" }));
    expect(isSyncEnabled()).toBe(true);
  });

  it("turns sync off again", () => {
    window.localStorage.setItem("kapi:v2:sync-enabled", "1");
    render(<SyncNotice />);
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(isSyncEnabled()).toBe(false);
  });
});

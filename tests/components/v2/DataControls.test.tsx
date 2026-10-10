// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasConsent, recordConsent, eraseLog, signOut } = vi.hoisted(() => ({
  hasConsent: vi.fn(),
  recordConsent: vi.fn(),
  eraseLog: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/privacy/consent", () => ({ hasConsent, recordConsent, eraseLog }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

import DataControls from "@/components/v2/DataControls";
import { isSyncEnabled } from "@/lib/sync/enabled";

beforeEach(() => {
  window.localStorage.clear();
  signOut.mockReset().mockResolvedValue({});
  hasConsent.mockReset().mockResolvedValue(false);
  recordConsent.mockReset().mockResolvedValue(true);
  eraseLog.mockReset().mockResolvedValue(true);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const syncOn = () => window.localStorage.setItem("kapi:v2:sync-enabled", "1");

describe("DataControls", () => {
  it("says nothing is stored when sync is off", async () => {
    render(<DataControls />);
    expect(await screen.findByText(/Nothing about you is stored on an account/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows the opt-in unticked by default and records a change", async () => {
    syncOn();
    render(<DataControls />);
    const box = await screen.findByRole("checkbox");
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(recordConsent).toHaveBeenCalledWith("product_improvement", true);
    await waitFor(() => expect(box).toBeChecked());
  });

  it("withdrawing consent also deletes what was already logged", async () => {
    syncOn();
    hasConsent.mockResolvedValue(true);
    render(<DataControls />);
    const box = await screen.findByRole("checkbox");
    await waitFor(() => expect(box).toBeChecked());
    fireEvent.click(box);
    await waitFor(() => expect(eraseLog).toHaveBeenCalledTimes(1));
    expect(recordConsent).toHaveBeenCalledWith("product_improvement", false);
    expect(box).not.toBeChecked();
  });

  it("does not erase anything when consent is granted", async () => {
    syncOn();
    render(<DataControls />);
    fireEvent.click(await screen.findByRole("checkbox"));
    await waitFor(() => expect(recordConsent).toHaveBeenCalled());
    expect(eraseLog).not.toHaveBeenCalled();
  });

  it("says so when earlier records could not be deleted", async () => {
    syncOn();
    hasConsent.mockResolvedValue(true);
    eraseLog.mockResolvedValue(false);
    render(<DataControls />);
    const box = await screen.findByRole("checkbox");
    await waitFor(() => expect(box).toBeChecked());
    fireEvent.click(box);
    expect(await screen.findByText(/earlier records could not be deleted/)).toBeInTheDocument();
  });

  it("reverts the checkbox and says so when the choice can't be saved", async () => {
    syncOn();
    recordConsent.mockResolvedValue(false);
    render(<DataControls />);
    const box = await screen.findByRole("checkbox");
    fireEvent.click(box);
    expect(await screen.findByText(/Could not save that choice/)).toBeInTheDocument();
    expect(box).not.toBeChecked();
  });

  it("asks to confirm, then deletes the account and turns sync off", async () => {
    syncOn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<DataControls />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete my account and its data" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete everything" }));
    expect(await screen.findByText(/has been deleted/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/account", { method: "DELETE" });
    expect(isSyncEnabled()).toBe(false);
    expect(signOut).toHaveBeenCalled();
  });

  it("keeps sync on and shows an error when deletion fails", async () => {
    syncOn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<DataControls />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete my account and its data" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete everything" }));
    expect(await screen.findByText(/Could not delete your account/)).toBeInTheDocument();
    expect(isSyncEnabled()).toBe(true);
  });
});

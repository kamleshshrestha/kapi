// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getAccountInfo: vi.fn(),
  requestLinkCode: vi.fn(),
  confirmLinkCode: vi.fn(),
  requestSignInCode: vi.fn(),
  confirmSignInCode: vi.fn(),
  signOutHere: vi.fn(),
}));
vi.mock("@/lib/supabase/emailAuth", () => api);

import EmailAccount from "@/components/v2/EmailAccount";
import { isSyncEnabled } from "@/lib/sync/enabled";

const anon = { userId: "u1", email: null, isAnonymous: true };
const ok = { ok: true };

beforeEach(() => {
  window.localStorage.clear();
  for (const fn of Object.values(api)) fn.mockReset();
  api.getAccountInfo.mockResolvedValue(anon);
  api.signOutHere.mockResolvedValue(undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const syncOn = () => window.localStorage.setItem("kapi:v2:sync-enabled", "1");
const type = async (label: RegExp | string, value: string) =>
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });

describe("EmailAccount", () => {
  it("renders nothing when Supabase isn't configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { container } = render(<EmailAccount />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers only sign-in when progress isn't being saved", async () => {
    render(<EmailAccount />);
    expect(await screen.findByRole("button", { name: "Sign in with email" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep access with your email" })).toBeNull();
  });

  it("also offers to keep access when an anonymous account is saving progress", async () => {
    syncOn();
    render(<EmailAccount />);
    expect(await screen.findByRole("button", { name: "Keep access with your email" })).toBeInTheDocument();
  });

  it("links an email: asks for it, then the code, then confirms", async () => {
    syncOn();
    api.requestLinkCode.mockResolvedValue(ok);
    api.confirmLinkCode.mockResolvedValue(ok);
    render(<EmailAccount />);
    fireEvent.click(await screen.findByRole("button", { name: "Keep access with your email" }));
    await type("Email", "me@example.com");
    api.getAccountInfo.mockResolvedValue({ userId: "u1", email: "me@example.com", isAnonymous: false });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await type(/Code from the email/, "123456");
    fireEvent.click(await screen.findByRole("button", { name: "Save email" }));
    expect(await screen.findByText(/Email saved/)).toBeInTheDocument();
    expect(api.requestLinkCode).toHaveBeenCalledWith("me@example.com");
    expect(api.confirmLinkCode).toHaveBeenCalledWith("me@example.com", "123456");
    expect(await screen.findByText(/Signed in as me@example.com/)).toBeInTheDocument();
  });

  it("signing in turns on sync so the account's progress loads", async () => {
    api.requestSignInCode.mockResolvedValue(ok);
    api.confirmSignInCode.mockResolvedValue(ok);
    render(<EmailAccount />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with email" }));
    await type("Email", "me@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await type(/Code from the email/, "654321");
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Signed in\. Your saved progress/)).toBeInTheDocument();
    expect(api.confirmSignInCode).toHaveBeenCalledWith("me@example.com", "654321");
    expect(isSyncEnabled()).toBe(true);
  });

  it("linking does not change the sync setting", async () => {
    api.requestLinkCode.mockResolvedValue(ok);
    api.confirmLinkCode.mockResolvedValue(ok);
    syncOn();
    render(<EmailAccount />);
    fireEvent.click(await screen.findByRole("button", { name: "Keep access with your email" }));
    await type("Email", "me@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await type(/Code from the email/, "123456");
    fireEvent.click(await screen.findByRole("button", { name: "Save email" }));
    await screen.findByText(/Email saved/);
    expect(isSyncEnabled()).toBe(true);
  });

  it("shows a message and stays on the step when the email is taken", async () => {
    syncOn();
    api.requestLinkCode.mockResolvedValue({ ok: false, reason: "taken" });
    render(<EmailAccount />);
    fireEvent.click(await screen.findByRole("button", { name: "Keep access with your email" }));
    await type("Email", "me@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already has an account");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("keeps the code step open after a wrong code", async () => {
    api.requestSignInCode.mockResolvedValue(ok);
    api.confirmSignInCode.mockResolvedValue({ ok: false, reason: "bad-code" });
    render(<EmailAccount />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with email" }));
    await type("Email", "me@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await type(/Code from the email/, "000000");
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("didn't work");
    expect(screen.getByLabelText(/Code from the email/)).toBeInTheDocument();
    expect(isSyncEnabled()).toBe(false);
  });

  it("signs out on this device and turns sync off, leaving the account alone", async () => {
    syncOn();
    api.getAccountInfo.mockResolvedValue({ userId: "u1", email: "me@example.com", isAnonymous: false });
    render(<EmailAccount />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(api.signOutHere).toHaveBeenCalled());
    expect(isSyncEnabled()).toBe(false);
    expect(await screen.findByText(/account and saved progress are unchanged/)).toBeInTheDocument();
  });

  it("cancel closes the form", async () => {
    render(<EmailAccount />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with email" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in with email" })).toBeInTheDocument();
  });
});

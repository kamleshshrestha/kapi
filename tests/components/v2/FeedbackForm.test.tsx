// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FeedbackForm from "@/components/v2/FeedbackForm";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const send = () => screen.getByRole("button", { name: "Send feedback" });
const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("FeedbackForm", () => {
  it("cannot be sent while empty", () => {
    render(<FeedbackForm conceptId="overfitting" />);
    expect(send()).toBeDisabled();
  });

  it("sends the answer, comment and concept, then thanks the learner", async () => {
    render(<FeedbackForm conceptId="overfitting" />);
    fireEvent.click(screen.getByLabelText("Partly"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  too easy  " } });
    fireEvent.click(send());
    expect(await screen.findByText("Thanks, that helps.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/feedback");
    expect(sentBody()).toEqual({ foundGap: "partly", comment: "too easy", conceptId: "overfitting" });
  });

  it("accepts a comment alone", async () => {
    render(<FeedbackForm conceptId="overfitting" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nice" } });
    fireEvent.click(send());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody()).toEqual({ comment: "nice", conceptId: "overfitting" });
  });

  it("without a concept shows only the comment box", async () => {
    render(<FeedbackForm />);
    expect(screen.queryByLabelText("Yes")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
    fireEvent.click(send());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody()).toEqual({ comment: "hi" });
  });

  it("keeps the input and offers another try when sending fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    render(<FeedbackForm conceptId="overfitting" />);
    fireEvent.click(screen.getByLabelText("No"));
    fireEvent.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send");
    expect(screen.getByLabelText("No")).toBeChecked();
    expect(send()).toBeEnabled();
  });
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ChatInputBar from "@/components/v2/ChatInputBar";

afterEach(cleanup);

function setup(props: Partial<{ disabled: boolean; pending: boolean }> = {}) {
  const onSubmit = vi.fn();
  render(
    <ChatInputBar
      disabled={props.disabled ?? false}
      pending={props.pending ?? false}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, box: screen.getByRole("textbox") as HTMLTextAreaElement };
}

describe("ChatInputBar", () => {
  it("submits trimmed text on Send and clears the box", () => {
    const { onSubmit, box } = setup();
    fireEvent.change(box, { target: { value: "  my answer  " } });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("my answer");
    expect(box.value).toBe("");
  });

  it("submits on Enter but not on Shift+Enter", () => {
    const { onSubmit, box } = setup();
    fireEvent.change(box, { target: { value: "hello" } });

    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("does not submit blank text, and keeps Send disabled", () => {
    const { onSubmit, box } = setup();
    fireEvent.change(box, { target: { value: "   " } });

    fireEvent.keyDown(box, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("is inert with a 'Session complete' placeholder when disabled", () => {
    const { onSubmit, box } = setup({ disabled: true });

    expect(box).toBeDisabled();
    expect(box.placeholder).toBe("Session complete");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the typing placeholder while pending", () => {
    const { box } = setup({ disabled: true, pending: true });
    expect(box.placeholder).toBe("Kapi is typing…");
  });
});

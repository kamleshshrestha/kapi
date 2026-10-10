import { describe, expect, it } from "vitest";
import { scrubPii, toExcerpt } from "@/lib/privacy/pii";

describe("scrubPii", () => {
  it("removes emails and links", () => {
    expect(scrubPii("mail me at jo.doe+ml@uni-berlin.de or see https://example.com/x?y=1 and www.foo.org")).toBe(
      "mail me at [email] or see [link] and [link]",
    );
  });

  it("removes phone and card style numbers", () => {
    expect(scrubPii("call +49 170 1234567 now")).toBe("call [number] now");
    expect(scrubPii("card 4111 1111 1111 1111 ok")).toBe("card [number] ok");
  });

  it("removes IBANs", () => {
    expect(scrubPii("pay DE89 3704 0044 0532 0130 00 please")).toBe("pay [account number] please");
  });

  it("leaves ordinary ML numbers alone", () => {
    const text = "learning rate 0.001, then 0.01; weights 10 20 30; epoch 100 of 2024";
    expect(scrubPii(text)).toBe(text);
  });
});

describe("toExcerpt", () => {
  it("scrubs, collapses whitespace and trims", () => {
    expect(toExcerpt("  mail  a@b.co \n now ")).toBe("mail [email] now");
  });

  it("cuts long text to the limit with an ellipsis", () => {
    const out = toExcerpt("word ".repeat(300), 50);
    expect(out).toHaveLength(50);
    expect(out.endsWith("…")).toBe(true);
  });
});

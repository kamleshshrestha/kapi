import { describe, expect, it } from "vitest";

import { cleanFormula } from "@/lib/learning/v2/formula";

describe("cleanFormula", () => {
  it("keeps a plain-text formula", () => {
    expect(cleanFormula("y = b0 + b1*x")).toBe("y = b0 + b1*x");
    expect(cleanFormula("w <- w - lr * dL/dw")).toBe("w <- w - lr * dL/dw");
    expect(cleanFormula("sigma(z) = 1 / (1 + e^-z)")).toBe("sigma(z) = 1 / (1 + e^-z)");
  });

  it("collapses whitespace so it sits on one line", () => {
    expect(cleanFormula("  y =   b0\n+ b1*x  ")).toBe("y = b0 + b1*x");
  });

  it("drops LaTeX, which would be shown to a beginner as source", () => {
    // There is no renderer, so these would appear literally in the chat.
    expect(cleanFormula("y = \\beta_0 + \\beta_1 x")).toBeNull();
    expect(cleanFormula("$$y = mx + c$$")).toBeNull();
    expect(cleanFormula("\\(y = mx + c\\)")).toBeNull();
    expect(cleanFormula("e^{-z} = 1")).toBeNull();
    expect(cleanFormula("x_{i} = 1")).toBeNull();
  });

  it("drops markdown emphasis that would show as asterisks", () => {
    expect(cleanFormula("**MSE** = average error")).toBeNull();
  });

  it("drops prose, which belongs in the explanation", () => {
    expect(cleanFormula("The line minimises the squared error")).toBeNull();
    expect(
      cleanFormula(
        "MSE = the average of the squared differences between each actual value and the value the model predicted for it, across every row",
      ),
      "too long to be a formula",
    ).toBeNull();
  });

  it("treats nothing as nothing", () => {
    expect(cleanFormula(null)).toBeNull();
    expect(cleanFormula(undefined)).toBeNull();
    expect(cleanFormula("   ")).toBeNull();
  });
});

/**
 * A formula Kapi may show beside its explanation. A user with some maths
 * background said that "using standard formulas would help users understand
 * the topic much better than long text explanations", so the model may offer
 * one; whether it does is adaptive, decided from how the learner writes.
 *
 * The app renders plain text in a monospace block rather than typeset maths:
 * it has no LaTeX renderer, and pulling one in would mean a beginner sees a
 * red error box whenever the model emits something malformed. So anything that
 * would not read correctly as plain text is dropped rather than shown.
 */

/** LaTeX or markdown maths: would be shown to the learner as source. */
const MARKUP = /\\[a-zA-Z(){[\]]|\$\$?|\^\{|_\{|~~|\*\*/;

/** A formula is a short relation, not a sentence that happens to contain one. */
const RELATION = /[=≈←<>≤≥∝]/;

const MAX_LENGTH = 120;

/**
 * Returns the formula to show, or null if it should be dropped. Runs on the
 * server, so nothing that fails these checks reaches the browser.
 */
export function cleanFormula(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > MAX_LENGTH) return null;
  if (MARKUP.test(text)) return null;
  if (!RELATION.test(text)) return null;
  return text;
}

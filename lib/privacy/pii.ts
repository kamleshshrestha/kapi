/**
 * Best-effort removal of obvious personal identifiers from learner text
 * before any of it is stored (the opt-in log). It cannot catch names or
 * free-form personal details, which is why the log keeps only a short
 * excerpt, only after consent. Conservative on purpose: ordinary ML numbers
 * such as "0.001" or "10 20 30" are left alone.
 */
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g;
// A run of digits with separators; only treated as a phone/card number when
// it holds at least 8 digits.
const NUMBER_RUN = /(?<![\w.])\+?\d[\d\s().-]{6,}\d(?![\w.])/g;

export function scrubPii(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(URL, "[link]")
    .replace(IBAN, "[account number]")
    .replace(NUMBER_RUN, (match) =>
      match.replace(/\D/g, "").length >= 8 ? "[number]" : match,
    );
}

/** Scrubs, collapses whitespace and cuts to `max` characters. */
export function toExcerpt(text: string, max = 500): string {
  const clean = scrubPii(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

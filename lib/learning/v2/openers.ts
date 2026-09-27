/**
 * Cached opener variants shown the instant a chat session loads — no LLM
 * call, so there is no typing-indicator wait before the learner sees
 * anything. Draft copy: reword freely.
 */
const OPENER_TEMPLATES: ((title: string) => string)[] = [
  (title) =>
    `Hey! Ready to dig into ${title} — what's your take on what it's actually doing?`,
  (title) =>
    `${title} — before I explain anything, pretend I've never heard of it. How would you describe it?`,
  (title) =>
    `Let's talk ${title}. If a friend asked you "what is this thing anyway," what would you say?`,
];

export function pickOpener(conceptTitle: string): string {
  const template =
    OPENER_TEMPLATES[Math.floor(Math.random() * OPENER_TEMPLATES.length)];
  return template(conceptTitle);
}

export function welcomeBackOpener(
  conceptTitle: string,
  last: { misconceptionTitle: string; resolved: boolean },
): string {
  return last.resolved
    ? `Hey, back for ${conceptTitle} — last time you nailed "${last.misconceptionTitle}". Want to try a different angle, or pick a new concept?`
    : `Hey, back for ${conceptTitle} — last time you were working through "${last.misconceptionTitle}". Want to pick that back up, or start fresh?`;
}

/**
 * Most follow-up questions Kapi asks in one session (the opening probe
 * included). It leaves room to build up a struggling learner's understanding
 * before checking it. The model decides earlier when the concept has been
 * covered; this is the hard stop, enforced by both the route and the hook.
 */
export const MAX_CHAT_TURNS = 7;

/** How many of the latest messages are sent back as conversation context. */
export const CHAT_HISTORY_LIMIT = 12;

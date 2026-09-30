/**
 * Most follow-up questions Kapi asks in one session (the opening probe
 * included). The model decides earlier when the concept has been covered; this
 * is the hard stop, enforced by both the route and the hook.
 */
export const MAX_CHAT_TURNS = 5;

/** How many of the latest messages are sent back as conversation context. */
export const CHAT_HISTORY_LIMIT = 12;

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Kapi (formerly Learning Debugger; the repo keeps the name `learners-app`) — a web app that helps beginner machine-learning learners identify *specifically* what they misunderstand about a concept, rather than giving them another generic explanation.

The learner experience is a chat-first session with flashcards, available for all six catalog concepts (gradient descent, backpropagation, overfitting, train/test split, linear regression and logistic regression). It lives under `/v2` (the earlier quiz-style v1 flow has been removed; `/` redirects to `/v2`, and the `v2` names in paths, folders and localStorage keys are kept so stored learner data and URLs don't change). A concept in `lib/learning/concepts.ts` without misconceptions has no Core flashcards and the chat cannot diagnose it. Unit tests run with Vitest.

Learner flow: pick a concept (`/v2`) → explain it in your own words in a chat with Kapi → the LLM finds the specific gap (or compliments a strong explanation and challenges it) → a progressive conversation of up to 5 questions, with hints before reveals and help chips (hint / "I'm lost" / explain differently) → a recap at the end. Resolved ideas and shaky ideas are saved as personal flashcards ("From you" deck, alongside the catalog-derived "Core" deck at `/v2/decks/[concept]`). A too-thin first explanation falls back to the first diagnostic question's options as quick replies.

## Commands

Package manager is pnpm (`packageManager: pnpm@10.33.0` in package.json).

- `pnpm dev` — start the dev server (http://localhost:3000)
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — run ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next`'s core-web-vitals and typescript rule sets)
- `pnpm test` — run the Vitest unit tests once (`pnpm test:watch` to watch). Config is `vitest.config.mts`; tests live in `tests/**/*.test.{ts,tsx}` and use the `@/` alias. Covered so far: `lib/learning/` (incl. the content rules and `v2/` helpers), `lib/llm/` (`client.ts`, `rate-limit.ts`, `schemas.ts`, `scrub.ts`; in `client.ts` tests fetch is stubbed with `vi.stubGlobal` and backoff uses fake timers), the `/api/v2/chat` route (`tests/app/api/v2/chat/route.test.ts`), the `useV2ChatSession` and `useFlashcardDeck` hooks (`tests/hooks/`) and the v2 chat/flashcard components (`tests/components/v2/`). Hook and component tests run in jsdom via a `// @vitest-environment jsdom` docblock with `@testing-library/react`, and also import `@testing-library/jest-dom/vitest`.

## Architecture

- Next.js App Router (`app/` directory), TypeScript, Tailwind CSS v4 (via `@tailwindcss/postcss`, no `tailwind.config` file — v4 uses CSS-based config in `app/globals.css`).
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
### Folder structure

```
app/
├── page.tsx                 redirects to /v2
├── v2/
│   ├── page.tsx             concept selection
│   ├── learn/[concept]/     the chat session
│   └── decks/[concept]/     flashcard review (Core + "From you" decks)
└── api/v2/
    ├── chat/route.ts        chat phases: diagnose, check, assist, summary (leak-checked hints)
    └── flashcards/route.ts  stub (501)
components/v2/               ConceptSelectorV2, ChatThread, ChatBubble, ChatInputBar, QuickReplyChips,
                             AssistChips, SessionSummary, FlashcardDeck, Flashcard
hooks/
├── useV2ChatSession.ts      chat state machine, help/hint/retry/recap, calls /api/v2/chat
└── useFlashcardDeck.ts      deck walk-through, self-rating, "review missed"
lib/
├── llm/                     client.ts (OpenRouter client, generateStructured, request helpers),
│                            prompts.ts, schemas.ts (zod request + structured-output schemas),
│                            scrub.ts (strips internal misconception ids from learner-facing model text)
└── learning/                domain logic, no React/LLM dependencies:
                             concepts.ts, misconceptions.ts, diagnostic.ts (question bank: content rules
                             below + quick-reply fallback), types.ts, v2/ (chatFlow limits, openers,
                             flashcards, personalCards, flashcardMastery, localSession)
tests/                       mirrors lib/, app/, hooks/ and components/ (Vitest; `lib/llm/prompts.ts` is only partly covered through the route tests)
```

Conventions:
- LLM calls happen only in `app/api/*` route handlers via `lib/llm/`; components and hooks call the API routes and never import `lib/llm/` (keeps the API key server-side). Types shared with the client live in `lib/learning/types.ts`.
- LLM calls go to OpenRouter's chat-completions API via `fetch` (no SDK). The model is `OPENROUTER_MODEL` from the environment, defaulting to the free `qwen/qwen3.8-27b:free` (constant `MODEL` in `lib/llm/client.ts`). Free models are often rate limited or overloaded and take ~10-15s per call. Outputs are requested as JSON schema (from the zod schemas), then validated with zod and retried once on invalid output. The chat's conversation history comes back from the client on each turn, so it is treated as untrusted too. Model text shown to learners must not expose internal ids: the prompts forbid it and `/api/v2/chat` also runs every learner-facing field through `scrubMisconceptionIds`. First-try feedback and hints must not reveal the answer: the prompt says so, and a reviewer call (`guardAgainstLeak`) rewrites them if they do (falling back to neutral feedback if that call fails). Learner free text is untrusted: prompts wrap it in `<learner_...>` tags, and routes validate ids against the catalog server-side rather than trusting client-supplied misconception text.
- Diagnostic content rules (enforced by `tests/lib/learning/diagnostic.test.ts`): every question has exactly one correct option and its wrong options link to real misconceptions of the same concept; a concept has either both questions and misconceptions or neither; the correct answer's position varies within a concept; and the correct answer is not the longest option in more than half of a concept's questions, nor more than 60% longer than the longest wrong option (learners can otherwise guess "pick the longest").
- `lib/learning/` stays pure (no React, no LLM) so it is easy to unit test; shared types live in `lib/learning/types.ts`.
- Secrets go in `.env.local` (gitignored via `.env*`). It must contain `OPENROUTER_API_KEY` and may set `OPENROUTER_MODEL`; restart `pnpm dev` after changing it. Without a key the API routes return a 500 "AI service is not configured" error. The API routes have no auth, but each starts with `checkRateLimit(request)` (`lib/llm/rate-limit.ts`): an in-memory fixed-window limit per client address (`x-forwarded-for`/`x-real-ip`; default 20 requests per 10 min) plus a global cap (default 500 per hour), returning 429 with `Retry-After`. Tune with `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_GLOBAL_MAX`, `RATE_LIMIT_GLOBAL_WINDOW_SECONDS`. Counters are per server instance (reset on restart, not shared across serverless instances) and the address headers are only trustworthy behind a proxy that sets them, so this limits abuse of the API key rather than enforcing exact quotas. New LLM-backed routes must call it first.

### Framework notes

- `app/layout.tsx` defines the root layout and loads the Geist font pair via `next/font/google`.
- This project pins a pre-release/breaking-changes version of Next.js (16.3.6) — see the note injected at the top of `AGENTS.md` (regenerated by `next dev`) instructing that framework docs live in `node_modules/next/dist/docs/` and should be consulted before relying on familiar Next.js APIs, since conventions may differ from training data (e.g. the typed `LayoutProps<"/">` prop used in `app/layout.tsx`).

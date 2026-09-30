# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Kapi (formerly Learning Debugger; the repo keeps the name `learners-app`) — a web app that helps beginner machine-learning learners identify *specifically* what they misunderstand about a concept, rather than giving them another generic explanation.

The core learner flow is implemented end to end for all six catalog concepts (gradient descent, backpropagation, overfitting, train/test split, linear regression and logistic regression). A concept added to `lib/learning/concepts.ts` without questions and misconceptions in `lib/learning/` shows a "coming soon" state on `/learn`. Unit tests run with Vitest.

Learner flow: pick a concept (`/`) → 4 multiple-choice diagnostic questions → explain the concept in your own words (free text) → LLM diagnosis of the specific misconception → targeted explanation → LLM-graded verification question.

## Commands

Package manager is pnpm (`packageManager: pnpm@10.33.0` in package.json).

- `pnpm dev` — start the dev server (http://localhost:3000)
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — run ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next`'s core-web-vitals and typescript rule sets)
- `pnpm test` — run the Vitest unit tests once (`pnpm test:watch` to watch). Config is `vitest.config.mts`; tests live in `tests/**/*.test.{ts,tsx}` and use the `@/` alias. Covered so far: `lib/learning/`, `lib/llm/` (`client.ts`, `rate-limit.ts`, `schemas.ts`, `scrub.ts`; in `client.ts` tests fetch is stubbed with `vi.stubGlobal` and backoff uses fake timers) the `/api/diagnose` route (`tests/app/api/diagnose/route.test.ts`) the `/api/v2/chat` route (`tests/app/api/v2/chat/route.test.ts`) and the `useV2ChatSession` and `useFlashcardDeck` hooks (`tests/hooks/`) and the v2 chat/flashcard components (`tests/components/v2/`; all jsdom tests also import `@testing-library/jest-dom/vitest`, jsdom via a `// @vitest-environment jsdom` docblock plus `@testing-library/react`).

## Architecture

- Next.js App Router (`app/` directory), TypeScript, Tailwind CSS v4 (via `@tailwindcss/postcss`, no `tailwind.config` file — v4 uses CSS-based config in `app/globals.css`).
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
### Folder structure

```
app/
├── page.tsx                 landing + concept selection
├── learn/page.tsx           the learning session flow
└── api/
    ├── diagnose/route.ts    MCQ answers + free-text explanation → misconception diagnosis
    ├── explain/route.ts     diagnosis → targeted explanation + verification question
    └── verify/route.ts      grades the verification answer
components/                  UI: ConceptSelector, LearningSession (stage switcher), SessionProgress,
                             DiagnosticQuestion, AnswerInput (radio), FreeTextAnswer (textarea),
                             DiagnosisCard, ExplanationCard, VerificationQuestion
hooks/
└── useLearningSession.ts    client-side session state + calls to the API routes
lib/
├── llm/                     client.ts (OpenRouter client, generateStructured, request helpers),
│                            prompts.ts, schemas.ts (zod request + structured-output schemas),
│                            scrub.ts (strips internal misconception ids from learner-facing model text)
└── learning/                domain logic, no React/LLM dependencies:
                             concepts.ts, misconceptions.ts, diagnostic.ts,
                             session.ts (pure stage transitions), types.ts
tests/                       mirrors lib/, app/ and components/ (Vitest; `lib/learning/`, `lib/llm/` except prompts.ts, and `/api/diagnose` covered; other routes, prompts and components not yet)
```

Conventions:
- LLM calls happen only in `app/api/*` route handlers via `lib/llm/`; components and hooks call the API routes and never import `lib/llm/` (keeps the API key server-side). Types shared with the client live in `lib/learning/types.ts`.
- LLM calls go to OpenRouter's chat-completions API via `fetch` (no SDK). The model is `OPENROUTER_MODEL` from the environment, defaulting to the free `qwen/qwen3.8-27b:free` (constant `MODEL` in `lib/llm/client.ts`). Free models are often rate limited or overloaded and take ~10-15s per call. Outputs are requested as JSON schema (from the zod schemas), then validated with zod and retried once on invalid output. Model text shown to learners must not expose internal ids: the diagnosis prompt forbids it and `/api/diagnose` also runs `reasoning` through `scrubMisconceptionIds`. Learner free text is untrusted: prompts wrap it in `<learner_...>` tags, and routes validate ids against the catalog server-side rather than trusting client-supplied misconception text.
- Diagnostic content rules (enforced by `tests/lib/learning/diagnostic.test.ts`): every question has exactly one correct option and its wrong options link to real misconceptions of the same concept; a concept has either both questions and misconceptions or neither; the correct answer's position varies within a concept; and the correct answer is not the longest option in more than half of a concept's questions, nor more than 60% longer than the longest wrong option (learners can otherwise guess "pick the longest").
- `lib/learning/` stays pure (no React, no LLM) so it is easy to unit test; shared types live in `lib/learning/types.ts`.
- Secrets go in `.env.local` (gitignored via `.env*`). It must contain `OPENROUTER_API_KEY` and may set `OPENROUTER_MODEL`; restart `pnpm dev` after changing it. Without a key the API routes return a 500 "AI service is not configured" error. The API routes have no auth, but each starts with `checkRateLimit(request)` (`lib/llm/rate-limit.ts`): an in-memory fixed-window limit per client address (`x-forwarded-for`/`x-real-ip`; default 20 requests per 10 min) plus a global cap (default 500 per hour), returning 429 with `Retry-After`. Tune with `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_GLOBAL_MAX`, `RATE_LIMIT_GLOBAL_WINDOW_SECONDS`. Counters are per server instance (reset on restart, not shared across serverless instances) and the address headers are only trustworthy behind a proxy that sets them, so this limits abuse of the API key rather than enforcing exact quotas. New LLM-backed routes must call it first.

### Framework notes

- `app/layout.tsx` defines the root layout and loads the Geist font pair via `next/font/google`.
- This project pins a pre-release/breaking-changes version of Next.js (16.3.6) — see the note injected at the top of `AGENTS.md` (regenerated by `next dev`) instructing that framework docs live in `node_modules/next/dist/docs/` and should be consulted before relying on familiar Next.js APIs, since conventions may differ from training data (e.g. the typed `LayoutProps<"/">` prop used in `app/layout.tsx`).

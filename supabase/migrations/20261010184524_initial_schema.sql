-- Kapi initial schema.
--
-- Mirrors the per-browser localStorage state in lib/learning/v2/ (last session,
-- personal cards, flashcard mastery) and adds the two GDPR-relevant tables:
-- consents (append-only record of what the learner agreed to) and
-- session_events (opt-in misconception log).
--
-- Every table references auth.users with ON DELETE CASCADE, so deleting a
-- user (the "delete my account" button) erases all of their data. Anonymous
-- sign-ins carry the `authenticated` Postgres role, so policies must check
-- ownership (auth.uid() = user_id), never just the role.

-- ---------------------------------------------------------------------------
-- Learner state (read and written by the browser under RLS)
-- ---------------------------------------------------------------------------

-- Outcome of the last chat session per concept (LastSessionOutcome).
create table public.last_sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concept_id text not null,
  misconception_id text not null,
  misconception_title text not null,
  resolved boolean not null,
  at timestamptz not null,
  primary key (user_id, concept_id)
);

-- "From you" flashcards (PersonalCard). `id` is client-generated, so it is
-- only unique per learner.
create table public.personal_cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  concept_id text not null,
  misconception_id text,
  front text not null check (char_length(front) <= 2000),
  back text not null check (char_length(back) <= 2000),
  resolved_at timestamptz not null,
  kind text not null default 'resolved' check (kind in ('resolved', 'revisit')),
  primary key (user_id, id)
);
create index personal_cards_user_concept_idx on public.personal_cards (user_id, concept_id);

-- Last self-rating per flashcard (MasteryRating).
create table public.card_mastery (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concept_id text not null,
  card_id text not null,
  rating text not null check (rating in ('forgot', 'fuzzy', 'got-it')),
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id, card_id)
);

-- ---------------------------------------------------------------------------
-- GDPR
-- ---------------------------------------------------------------------------

-- Append-only consent record. The current state of a purpose is its newest
-- row; withdrawing consent inserts a new row with granted = false.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('product_improvement', 'reminders')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);
create index consents_user_purpose_idx on public.consents (user_id, purpose, created_at desc);

-- Opt-in misconception log. Written only by the server (service role) after it
-- has checked the learner's current product_improvement consent. `excerpt` is
-- a short, PII-scrubbed piece of the learner's text, never a full transcript.
create table public.session_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  concept_id text not null,
  turn smallint not null check (turn >= 0),
  misconception_id text,
  result text not null check (result in ('correct', 'hinted', 'revealed', 'diagnosed')),
  excerpt text check (char_length(excerpt) <= 500),
  created_at timestamptz not null default now()
);
create index session_events_user_idx on public.session_events (user_id);
create index session_events_created_idx on public.session_events (created_at);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.last_sessions enable row level security;
alter table public.personal_cards enable row level security;
alter table public.card_mastery enable row level security;
alter table public.consents enable row level security;
alter table public.session_events enable row level security;

-- State tables: a learner can read and write only their own rows.
create policy "own rows: select" on public.last_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.last_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.last_sessions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.last_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "own rows: select" on public.personal_cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.personal_cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.personal_cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.personal_cards for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "own rows: select" on public.card_mastery for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.card_mastery for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.card_mastery for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.card_mastery for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Consents are append-only for learners: read and insert, never edit.
create policy "own rows: select" on public.consents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Log rows: learners can read (data export) and delete (erasure without
-- deleting the account) their own rows. No insert policy: only the service
-- role writes here.
create policy "own rows: select" on public.session_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.session_events for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Data API grants (RLS filters rows; grants decide whether the table is
-- reachable at all). Nothing for anon: every visitor signs in anonymously.
-- ---------------------------------------------------------------------------

revoke all on public.last_sessions, public.personal_cards, public.card_mastery,
  public.consents, public.session_events from anon, authenticated;

grant select, insert, update, delete on public.last_sessions to authenticated;
grant select, insert, update, delete on public.personal_cards to authenticated;
grant select, insert, update, delete on public.card_mastery to authenticated;
grant select, insert on public.consents to authenticated;
grant select, delete on public.session_events to authenticated;

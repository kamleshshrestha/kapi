-- Learner feedback (the prompt after a finished session, and /feedback).
-- Written only by the server with the secret key (it scrubs and caps the
-- text first). user_id is set when the learner has an account, so the export
-- and account deletion cover their feedback; otherwise it is null and the
-- row carries no identifier at all (no IP address, no session id).
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  concept_id text,
  found_gap text check (found_gap in ('yes', 'partly', 'no')),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  check (found_gap is not null or comment is not null)
);

alter table public.feedback enable row level security;

-- Learners may read their own rows (for the export); nobody writes through
-- the Data API.
create policy "own rows: select" on public.feedback for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;

-- Same 12-month retention as the other stored data.
select cron.schedule(
  'kapi-retention-feedback',
  '29 3 * * *',
  $$delete from public.feedback where created_at < now() - interval '12 months'$$
);

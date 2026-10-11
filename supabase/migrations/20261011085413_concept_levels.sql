-- Depth-of-understanding levels per concept (see lib/learning/v2/levels.ts).
-- One row per concept and level: how many answers were clean (first try,
-- unaided) and how many were helped, plus when evidence was last added.
-- Counts and timestamps only, never learner text. Cascades from auth.users,
-- so deleting an account removes them.
create table public.concept_levels (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concept_id text not null,
  level text not null check (level in ('explain', 'apply', 'defend')),
  clean integer not null default 0 check (clean between 0 and 100000),
  helped integer not null default 0 check (helped between 0 and 100000),
  at timestamptz not null,
  primary key (user_id, concept_id, level)
);

alter table public.concept_levels enable row level security;

create policy "own rows: select" on public.concept_levels for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.concept_levels for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.concept_levels for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.concept_levels for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.concept_levels from anon, authenticated;
grant select, insert, update, delete on public.concept_levels to authenticated;

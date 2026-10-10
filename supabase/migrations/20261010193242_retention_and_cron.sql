-- Retention limits (GDPR storage limitation). Both jobs run daily and are
-- named, so re-running this migration replaces them instead of duplicating.

create extension if not exists pg_cron;

-- Opt-in misconception log: keep 12 months.
select cron.schedule(
  'kapi-retention-session-events',
  '17 3 * * *',
  $$delete from public.session_events where created_at < now() - interval '12 months'$$
);

-- Anonymous accounts nobody has signed in to or refreshed for 12 months. The
-- cascade removes their cards, ratings, consents and log rows.
select cron.schedule(
  'kapi-retention-anonymous-users',
  '23 3 * * *',
  $$delete from auth.users u
    where u.is_anonymous
      and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '12 months'
      and not exists (
        select 1 from auth.sessions s
        where s.user_id = u.id
          and coalesce(s.refreshed_at, s.created_at) > now() - interval '12 months'
      )$$
);

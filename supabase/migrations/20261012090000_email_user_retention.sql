-- Accounts that have an email (no longer anonymous) are kept for 24 months of
-- inactivity, twice as long as anonymous ones, because the learner chose to
-- keep access. The cascade removes their cards, levels, feedback and logs.
select cron.schedule(
  'kapi-retention-email-users',
  '31 3 * * *',
  $$delete from auth.users u
    where not u.is_anonymous
      and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '24 months'
      and not exists (
        select 1 from auth.sessions s
        where s.user_id = u.id
          and coalesce(s.refreshed_at, s.created_at) > now() - interval '24 months'
      )$$
);

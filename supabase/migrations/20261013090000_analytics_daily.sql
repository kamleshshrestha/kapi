-- Anonymous usage counters: one row per day, event, concept and detail, with a
-- running count. There is no user id, session id, IP address or any other
-- identifier, so a row cannot be tied to a person and the table is not
-- personal data. Events are only ever counted by the server (the secret key
-- calls count_event); nobody can read or write this through the Data API.
create table public.analytics_daily (
  day date not null,
  event text not null check (char_length(event) between 1 and 40),
  concept text not null default '' check (char_length(concept) <= 60),
  detail text not null default '' check (char_length(detail) <= 40),
  count bigint not null default 0 check (count >= 0),
  primary key (day, event, concept, detail)
);

alter table public.analytics_daily enable row level security;
revoke all on public.analytics_daily from anon, authenticated;

-- Adds p_count (normally one) to today's (UTC) counter. Runs with the caller's rights, so only a
-- role that can write the table (the server's secret key) can use it.
create function public.count_event(
  p_event text,
  p_concept text default '',
  p_detail text default '',
  p_count integer default 1
) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.analytics_daily (day, event, concept, detail, count)
  values ((now() at time zone 'utc')::date, p_event, p_concept, p_detail, greatest(p_count, 1))
  on conflict (day, event, concept, detail)
  do update set count = public.analytics_daily.count + greatest(p_count, 1)
$$;

revoke execute on function public.count_event(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.count_event(text, text, text, integer) to service_role;

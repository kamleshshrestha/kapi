// Prints Kapi's usage numbers: the anonymous daily counters (analytics_daily)
// and how many accounts that turned on "Save my progress" came back.
// Usage: pnpm stats [days]   (default 14). Needs POSTGRES_URL_NON_POOLING in
// .env.local and psql on the PATH, like the migrations.
import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the environment.
}

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING is not set (put it in .env.local).");
  process.exit(1);
}
const days = Number(process.argv[2] ?? "14");
if (!Number.isInteger(days) || days < 1 || days > 366) {
  console.error("days must be a whole number from 1 to 366.");
  process.exit(1);
}

const since = `(now() at time zone 'utc')::date - ${days - 1}`;
const sum = (event) => `coalesce(sum(count) filter (where event = '${event}'), 0)`;

const reports = [
  [
    `Per day (UTC), last ${days} days`,
    `select day,
       ${sum("chat_started")} as chats_started,
       ${sum("chat_finished")} as chats_finished,
       ${sum("teach_started")} as teach_started,
       ${sum("teach_finished")} as teach_finished,
       ${sum("model_error")} as model_errors,
       ${sum("rate_limited")} as rate_limited
     from public.analytics_daily
     where day >= ${since}
     group by day order by day desc`,
  ],
  [
    "Per concept: chats and how many reached the recap",
    `select concept,
       ${sum("chat_started")} as started,
       ${sum("chat_finished")} as finished,
       case when ${sum("chat_started")} = 0 then null
            else round(100.0 * ${sum("chat_finished")} / ${sum("chat_started")}) end as finished_pct,
       ${sum("teach_finished")} as teach_finished
     from public.analytics_daily
     where day >= ${since} and concept <> ''
     group by concept order by started desc`,
  ],
  [
    "Teach-it-back verdicts and model errors by status",
    `select event, detail, sum(count) as total
     from public.analytics_daily
     where day >= ${since} and event in ('teach_finished', 'model_error') and detail <> ''
     group by event, detail order by event, total desc`,
  ],
  [
    "Accounts that turned on Save my progress (all time)",
    `with activity as (
       select user_id, max(ts) as last_at from (
         select user_id, at as ts from public.last_sessions
         union all select user_id, at from public.concept_levels
         union all select user_id, resolved_at from public.personal_cards
         union all select user_id, updated_at from public.card_mastery
       ) x group by user_id
     )
     select count(*) as accounts,
       count(*) filter (where u.email is not null) as with_email,
       count(*) filter (where u.created_at < now() - interval '1 day') as older_than_a_day,
       count(*) filter (where a.last_at::date > u.created_at::date) as came_back_a_later_day
     from auth.users u left join activity a on a.user_id = u.id`,
  ],
];

for (const [title, sql] of reports) {
  console.log(`\n== ${title}`);
  const run = spawnSync("psql", [url, "-X", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
  if (run.status !== 0) {
    console.error(run.stderr || run.error?.message || "psql failed");
    process.exit(1);
  }
  console.log(run.stdout.trimEnd());
}

console.log(`
Notes: counted on the server only, so unique visitors, referrers and visits
that never start a chat are not measured. A retried recap counts twice. The
rate_limited count is batched (at most one write per 10 s per server instance)
and can undercount. "Came back" uses the newest progress timestamp of each
account, so it misses people who returned but did nothing that was saved.`);

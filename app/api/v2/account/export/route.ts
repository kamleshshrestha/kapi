import { checkRateLimit } from "@/lib/llm/rate-limit";
import { getVerifiedUser } from "@/lib/supabase/user";

const TABLES = [
  "last_sessions",
  "personal_cards",
  "card_mastery",
  "consents",
  "session_events",
] as const;

/** GDPR access/portability: everything stored about the signed-in learner, as JSON. */
export async function GET(request: Request) {
  const limited = checkRateLimit(request);
  if (limited) return limited;

  const user = await getVerifiedUser();
  if (!user) {
    return Response.json({ error: "No account to export." }, { status: 401 });
  }

  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    // RLS limits each query to this learner's own rows.
    const { data: rows, error } = await user.supabase.from(table).select("*");
    if (error) {
      return Response.json({ error: "Could not read your data." }, { status: 500 });
    }
    data[table] = rows ?? [];
  }

  return new Response(
    JSON.stringify(
      { exportedAt: new Date().toISOString(), userId: user.id, data },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="kapi-my-data.json"',
        "cache-control": "no-store",
      },
    },
  );
}

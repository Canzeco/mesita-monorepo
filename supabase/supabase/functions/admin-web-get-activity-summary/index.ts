// Supabase Edge Function — admin-web-get-activity-summary (MESITA-2745)
//
// Activity › Logs' Recent activity: guest opens of Google-only places and
// operator verbs, merged newest first. The counters it also answered left
// with Activity › Analytics (MESITA-3848). Super-admin only. Read-only.
//
// Local:  supabase functions serve admin-web-get-activity-summary
// Deploy: supabase functions deploy admin-web-get-activity-summary

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { type AdminOperatorEventRow, mergeActivityFeed } from "../_shared/admin-operator-events.ts";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;
const FEED_CAP = 50;

type Body = { windowDays?: number };

serveJson("admin-web-get-activity-summary", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const rawDays = bodyRes.body.windowDays;
  const windowDays = typeof rawDays === "number" && Number.isFinite(rawDays)
    ? Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.floor(rawDays)))
    : DEFAULT_WINDOW_DAYS;

  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const [feedOpensRes, feedOpsRes] = await Promise.all([
    admin
      .from("place_open_events")
      .select("id, created_at, outcome, google_place_id, place_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(FEED_CAP),
    admin
      .from("admin_operator_events")
      .select("id, verb, outcome, place_id, source, detail, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(FEED_CAP),
  ]);

  if (feedOpensRes.error) {
    console.error("[admin-web-get-activity-summary] opens:", feedOpensRes.error.message);
    return json({ ok: false, error: feedOpensRes.error.message }, 502);
  }
  if (feedOpsRes.error) {
    console.error("[admin-web-get-activity-summary] operator:", feedOpsRes.error.message);
    return json({ ok: false, error: feedOpsRes.error.message }, 502);
  }

  const recentFeed = mergeActivityFeed(
    (feedOpensRes.data ?? []) as Array<{
      id: number;
      created_at: string;
      outcome: string;
      google_place_id: string;
      place_id: string | null;
    }>,
    (feedOpsRes.data ?? []) as AdminOperatorEventRow[],
    FEED_CAP,
  );

  return json({ ok: true, windowDays, recentFeed });
});

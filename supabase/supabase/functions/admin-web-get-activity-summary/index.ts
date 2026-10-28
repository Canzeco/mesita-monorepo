// Supabase Edge Function — admin-web-get-activity-summary (MESITA-2745)
//
// Activity › Logs and Analytics: guest opens, social totals, operator verb
// counts, and a merged notification feed. Super-admin only. Read-only.
//
// Local:  supabase functions serve admin-web-get-activity-summary
// Deploy: supabase functions deploy admin-web-get-activity-summary

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  mergeActivityFeed,
  summarizeOperatorVerbs,
  type AdminOperatorEventRow,
} from "../_shared/admin-operator-events.ts";
import {
  type PlaceOpenRow,
  summarizePlaceOpens,
} from "../_shared/place-open-events.ts";
import { summarizeGuestSocial } from "../_shared/activity-summary.ts";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;
const ROW_CAP = 10_000;
const FEED_CAP = 50;

type Body = { windowDays?: number };

serveJson("admin-web-get-activity-summary", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const authRes = await getAuthedUser(req, env);
  if (!authRes.ok) return authRes.response;
  const admin = adminClient(env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const rawDays = bodyRes.body.windowDays;
  const windowDays = typeof rawDays === "number" && Number.isFinite(rawDays)
    ? Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.floor(rawDays)))
    : DEFAULT_WINDOW_DAYS;

  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const [opensRes, socialRes, operatorRes, feedOpensRes, feedOpsRes] = await Promise.all([
    admin
      .from("place_open_events")
      .select("google_place_id, outcome, place_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    admin
      .from("place_activity")
      .select("consumer_id, kind")
      .gte("created_at", since)
      .in("kind", ["viewed", "saved"])
      .limit(ROW_CAP),
    admin
      .from("admin_operator_events")
      .select("id, verb, outcome, place_id, source, detail, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
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

  if (opensRes.error) {
    console.error("[admin-web-get-activity-summary] opens:", opensRes.error.message);
    return json({ ok: false, error: opensRes.error.message }, 502);
  }
  if (socialRes.error) {
    console.error("[admin-web-get-activity-summary] social:", socialRes.error.message);
    return json({ ok: false, error: socialRes.error.message }, 502);
  }
  if (operatorRes.error) {
    console.error("[admin-web-get-activity-summary] operator:", operatorRes.error.message);
    return json({ ok: false, error: operatorRes.error.message }, 502);
  }

  const openRows = (opensRes.data ?? []) as PlaceOpenRow[];
  const guestOpens = summarizePlaceOpens(openRows);
  const guestSocial = summarizeGuestSocial(socialRes.data ?? []);
  const operatorRows = (operatorRes.data ?? []) as AdminOperatorEventRow[];
  const operatorVerbs = summarizeOperatorVerbs(operatorRows);

  const names: Record<string, string> = {};
  const ids = guestOpens.repeated.map((r) => r.googlePlaceId);
  if (ids.length > 0) {
    const named = await admin
      .from("profiles")
      .select("google_place_id, name")
      .in("google_place_id", ids);
    for (const row of (named.data ?? []) as Array<{ google_place_id: string | null; name: string | null }>) {
      if (row.google_place_id && row.name) names[row.google_place_id] = row.name;
    }
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

  return json({
    ok: true,
    windowDays,
    capped: {
      guestOpens: openRows.length >= ROW_CAP,
      operator: operatorRows.length >= ROW_CAP,
    },
    guestOpens,
    guestSocial,
    operatorVerbs,
    names,
    recentFeed,
  });
});

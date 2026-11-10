// Supabase Edge Function — business-web-get-place-views
//
// MESITA-3206: Business › Views. How many times signed-in guests viewed this
// place, and how many liked and shared it. A failed count is an error here,
// never a false 0: an owner reads these numbers as fact.
//
// MESITA-3392 (Pato: "every click on your profile is one view"): Views counts
// every open, from place_events, so it agrees with the chart and the log. Likes
// and Shares still count guests.
//
// MESITA-3213: and the chart's 30 days, in the place's timezone. The log is
// business-web-list-place-views-log.
//
// Body: { place_id: uuid }
// Response: { ok: true, views: number, likes: number, shares: number, timezone: string,
//             days: [{ day: "YYYY-MM-DD", views: number, likes: number, shares: number }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { readBoostPlace } from "../_shared/boost.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";

const CHART_DAYS = 30;
const DEFAULT_TIMEZONE = "America/Mexico_City";

/** The place's timezone when the runtime knows it. A bad value would fail the SQL. */
function usableTimezone(timezone: string | null | undefined): string {
  if (!timezone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

serveJson("business-web-get-place-views", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const placeRes = await readBoostPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const timezone = usableTimezone(placeRes.place?.timezone);

  const [views, likes, shares, days] = await Promise.all([
    // place_views_events drops closed accounts, as the chart does.
    admin.rpc("place_views_events", { p_place_id: placeId }, { count: "exact", head: true }).eq("kind", "viewed"),
    admin.from("place_activity").select("*", { count: "exact", head: true }).eq("place_id", placeId).eq("kind", "saved"),
    admin.from("place_shares").select("*", { count: "exact", head: true }).eq("place_id", placeId),
    admin.rpc("place_views_days", { p_place_id: placeId, p_timezone: timezone, p_days: CHART_DAYS }),
  ]);
  const failed = views.error ?? likes.error ?? shares.error ?? days.error;
  if (failed) return json({ ok: false, error: failed.message }, 500);

  return json({
    ok: true,
    views: views.count ?? 0,
    likes: likes.count ?? 0,
    shares: shares.count ?? 0,
    timezone,
    days: days.data ?? [],
  });
});

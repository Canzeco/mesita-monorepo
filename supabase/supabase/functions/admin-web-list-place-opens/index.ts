// Supabase Edge Function — admin-web-list-place-opens (product caller)
//
// Configurations › Creation's open counter (MESITA-2323): how many explicit
// opens of a Google-only result the guests made in the last 30 days, how
// they ended (existing · created · refused · failed), the share that landed
// on a Mesita profile, and the places opened more than once. Reads the
// place_open_events ledger consumer-web-create-place writes. Super-admin
// only. Read-only.
//
// Local:  supabase functions serve admin-web-list-place-opens
// Deploy: supabase functions deploy admin-web-list-place-opens

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import {
  type PlaceOpenRow,
  summarizePlaceOpens,
} from "../_shared/place-open-events.ts";

const WINDOW_DAYS = 30;
const ROW_CAP = 10_000;

serveJson("admin-web-list-place-opens", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("place_open_events")
    .select("google_place_id, outcome, place_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);
  if (error) {
    console.error("[admin-web-list-place-opens]", error.message);
    return json({ ok: false, error: error.message }, 502);
  }
  const rows = (data ?? []) as PlaceOpenRow[];
  const summary = summarizePlaceOpens(rows);

  // Names for the repeated places Mesita now holds.
  const ids = summary.repeated.map((r) => r.googlePlaceId);
  const names: Record<string, string> = {};
  if (ids.length > 0) {
    const named = await admin
      .from("profiles")
      .select("google_place_id, name")
      .in("google_place_id", ids);
    for (const row of (named.data ?? []) as Array<{ google_place_id: string | null; name: string | null }>) {
      if (row.google_place_id && row.name) names[row.google_place_id] = row.name;
    }
  }

  return json({
    ok: true,
    windowDays: WINDOW_DAYS,
    capped: rows.length >= ROW_CAP,
    summary,
    names,
  });
});

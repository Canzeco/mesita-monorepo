// Supabase Edge Function — admin-web-list-premier
//
// MESITA-3011: Manage › Premier, read. Every active Mesita place with its
// Premier standing — the tier, the Manual Premier running (Mesita's free
// lift, MESITA-3091) and the paid period running, how
// many pledges stand in its line and what it charged in the last 30 days —
// plus the totals and which Stripe universe the money runs in. One place's
// full line and the grant / end / remove writes stay on
// admin-web-get-place-premier and admin-web-grant-place-premier.
//
// Body:     {}
// Response: { ok: true, stripe: "test" | "live" | "off", totals, places: PremierRow[] }
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import {
  boostLivemode,
  boostStripeKey,
  chargingPeriod,
  ladder,
  type Manual,
  MANUAL_COLUMNS,
  type Period,
  PERIOD_COLUMNS,
  type Pledge,
  PLEDGE_COLUMNS,
  PREMIER_FACTOR,
  premierRankOf,
  runningManual,
  runningPeriod,
} from "../_shared/boost.ts";

const PLACE_LIMIT = 1000;
const DAY_MS = 86_400_000;

serveJson("admin-web-list-premier", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const now = Date.now();
  const since = new Date(now - 30 * DAY_MS).toISOString();
  const nowIso = new Date(now).toISOString();
  const [placesRes, pledgesRes, periodsRes, manualRes] = await Promise.all([
    admin.from("profiles").select("id, name, boost_tier").eq("state", "active").order("name").limit(PLACE_LIMIT),
    admin.from("place_backings").select(PLEDGE_COLUMNS).in("status", ["open", "ready", "failed"]).limit(5000),
    admin
      .from("place_premier_periods")
      .select(PERIOD_COLUMNS)
      .or(`ends_at.gte.${nowIso},created_at.gte.${since},status.eq.charging`)
      .limit(5000),
    admin.from("place_manual_premier").select(MANUAL_COLUMNS).gt("ends_at", nowIso).limit(5000),
  ]);
  if (placesRes.error) return json({ ok: false, error: `places_read: ${placesRes.error.message}` }, 500);
  if (pledgesRes.error) return json({ ok: false, error: `pledges_read: ${pledgesRes.error.message}` }, 500);
  if (periodsRes.error) return json({ ok: false, error: `periods_read: ${periodsRes.error.message}` }, 500);
  if (manualRes.error) return json({ ok: false, error: `manual_read: ${manualRes.error.message}` }, 500);

  const pledgesBy = group((pledgesRes.data ?? []) as Pledge[]);
  const periodsBy = group((periodsRes.data ?? []) as Period[]);
  const manualBy = group((manualRes.data ?? []) as Manual[]);
  const sinceMs = Date.parse(since);

  const places = ((placesRes.data ?? []) as { id: string; name: string | null; boost_tier: number | null }[]).map((p) => {
    const pledges = pledgesBy.get(p.id) ?? [];
    const periods = periodsBy.get(p.id) ?? [];
    const running = runningPeriod(periods, now);
    const manual = runningManual(manualBy.get(p.id) ?? [], now);
    const inLine = ladder(pledges).filter((x) => x.id !== running?.backing_id).length;
    const tier = premierRankOf(Number(p.boost_tier) || 0);
    return {
      id: p.id,
      name: p.name ?? "Unnamed place",
      tier,
      factor: PREMIER_FACTOR[tier],
      manual: manual ? { tier: manual.tier, ends_at: manual.ends_at, source: manual.source, granted_by: manual.granted_by } : null,
      period: running ? { tier: running.tier, ends_at: running.ends_at, granted: false, granted_by: null } : null,
      charging: chargingPeriod(periods) != null,
      backups: inLine,
      waiting: pledges.filter((x) => x.status === "open" || x.status === "failed").length,
      charged_30d_cents: periods
        .filter((x) => Date.parse(x.created_at) >= sinceMs)
        .reduce((sum, x) => sum + (x.charged_cents ?? 0), 0),
    };
  });

  const stripe = boostStripeKey() ? (boostLivemode() ? "live" : "test") : "off";
  return json({
    ok: true,
    stripe,
    totals: {
      premier_now: places.filter((p) => p.tier > 0).length,
      granted_now: places.filter((p) => p.manual).length,
      pledges: (pledgesRes.data ?? []).length,
      charged_30d_cents: places.reduce((sum, p) => sum + p.charged_30d_cents, 0),
    },
    places,
  });
});

function group<T extends { place_id: string }>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const list = out.get(r.place_id);
    if (list) list.push(r);
    else out.set(r.place_id, [r]);
  }
  return out;
}

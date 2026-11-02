// Supabase Edge Function — business-web-get-place-premier
//
// MESITA-2995 / MESITA-3092: Single Place › Premier, read. The place's tier,
// the period running, its pledges with first names (the console only): the
// one subscription first, then Checkouts in flight, and the recent periods
// with what each one charged, so the operator can see who pays for what
// without opening Stripe.
//
// Manual Premier (MESITA-3091) comes back on its own: `manual` is the row
// running now, `manual_history` the recent ones; `period` and `periods` are
// only what guests pay for.
//
// Body:     { placeId | projectId }
// Response: { ok: true, tier: 0..2, factor, manual | null, manual_history,
//             period | null, line: AdminPledge[], periods: AdminPeriod[], stuck: number }
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, readPlaceIdAlias, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { MEMBER_FALLBACK_NAME } from "../_shared/place-activity.ts";
import {
  PREMIER_FACTOR,
  premierRankOf,
  readBackerNames,
  readBoostPlace,
  readLine,
  runningManual,
  runningPeriod,
  TIER_RANK,
} from "../_shared/boost.ts";

serveJson("business-web-get-place-premier", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const [placeRes, line] = await Promise.all([
    readBoostPlace(admin, placeId),
    readLine(admin, placeId, { periodsSince: Date.now() - 400 * 86_400_000 }),
  ]);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (!placeRes.place) return json({ ok: false, error: "Place not found" }, 404);
  if (!line.ok) return json({ ok: false, error: line.error }, 500);

  const now = Date.now();
  const running = runningPeriod(line.periods, now);
  const manual = runningManual(line.manual, now);
  const live = line.pledges.filter((p) => p.status !== "ended");
  const order = [...live.filter((p) => p.status === "ready"), ...live.filter((p) => p.status !== "ready")];
  const payerIds = [...new Set(line.pledges.map((r) => r.consumer_id).filter((id): id is string => typeof id === "string"))];
  const names = await readBackerNames(admin, payerIds, MEMBER_FALLBACK_NAME);
  const nameById = new Map(payerIds.map((id, i) => [id, names[i]]));
  const pledgeName = new Map(line.pledges.map((p) => [p.id, p.consumer_id ? nameById.get(p.consumer_id) ?? MEMBER_FALLBACK_NAME : null]));
  const tier = premierRankOf(Number(placeRes.place.boost_tier) || 0);

  return json({
    ok: true,
    tier,
    factor: PREMIER_FACTOR[tier],
    manual: manual
      ? { id: manual.id, tier: manual.tier, starts_at: manual.starts_at, ends_at: manual.ends_at, source: manual.source, granted_by: manual.granted_by }
      : null,
    manual_history: line.manual.map((m) => ({
      id: m.id,
      tier: m.tier,
      starts_at: m.starts_at,
      ends_at: m.ends_at,
      source: m.source,
      granted_by: m.granted_by,
    })),
    period: running
      ? { id: running.id, tier: running.tier, ends_at: running.ends_at, granted: false, granted_by: null }
      : null,
    line: order.map((p) => ({
      id: p.id,
      payer: pledgeName.get(p.id) ?? null,
      tier: TIER_RANK[p.tier],
      interval: p.billing_interval,
      amount_cents: p.amount_cents,
      status: p.status,
      role: p.status === "ready" ? "payer" : "waiting",
      position: p.status === "ready" ? 0 : null,
      pending_tier: p.pending_tier ? TIER_RANK[p.pending_tier] : null,
      livemode: p.livemode,
      queued_at: p.queued_at,
    })),
    periods: line.periods.map((p) => ({
      id: p.id,
      payer: p.backing_id ? pledgeName.get(p.backing_id) ?? MEMBER_FALLBACK_NAME : null,
      granted_by: p.granted_by,
      tier: p.tier,
      interval: p.billing_interval,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      price_cents: p.price_cents,
      credit_cents: p.credit_cents,
      extra_days: p.extra_days,
      charged_cents: p.charged_cents,
      status: p.status,
    })),
    stuck: line.periods.filter((p) => p.status === "charging" && now - Date.parse(p.created_at) > 2 * 3600_000).length,
  });
});

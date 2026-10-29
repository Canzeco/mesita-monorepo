// Supabase Edge Function — admin-web-get-place-boost
//
// MESITA-2995: Single Place › Premier, read. The place's tier, the period
// running, the line with first names (the console only; guests never see a
// name, MESITA-2928), and the recent periods with what each one charged, so
// the operator can see who pays for what without opening Stripe.
//
// Body:     { placeId | projectId }
// Response: { ok: true, tier: 0..3, factor, period | null, line: AdminPledge[],
//             periods: AdminPeriod[], stuck: number }
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, readPlaceIdAlias, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { MEMBER_FALLBACK_NAME } from "../_shared/place-activity.ts";
import {
  BOOST_FACTOR,
  ladder,
  readBackerNames,
  readBoostPlace,
  readLine,
  runningPeriod,
  TIER_RANK,
} from "../_shared/boost.ts";

serveJson("admin-web-get-place-boost", async (req) => {
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
  const payerId = running?.backing_id ?? null;
  const order = [
    ...line.pledges.filter((p) => p.id === payerId),
    ...ladder(line.pledges).filter((p) => p.id !== payerId),
    ...line.pledges.filter((p) => p.id !== payerId && !(p.status === "ready" && p.stripe_payment_method_id)),
  ];
  const payerIds = [...new Set(line.pledges.map((r) => r.consumer_id).filter((id): id is string => typeof id === "string"))];
  const names = await readBackerNames(admin, payerIds, MEMBER_FALLBACK_NAME);
  const nameById = new Map(payerIds.map((id, i) => [id, names[i]]));
  const pledgeName = new Map(line.pledges.map((p) => [p.id, p.consumer_id ? nameById.get(p.consumer_id) ?? MEMBER_FALLBACK_NAME : null]));
  const tier = Math.min(Math.max(Number(placeRes.place.boost_tier) || 0, 0), 3) as 0 | 1 | 2 | 3;
  let backup = 0;

  return json({
    ok: true,
    tier,
    factor: BOOST_FACTOR[tier],
    period: running
      ? { id: running.id, tier: running.tier, ends_at: running.ends_at, granted: running.backing_id == null, granted_by: running.granted_by }
      : null,
    line: order.map((p) => ({
      id: p.id,
      payer: pledgeName.get(p.id) ?? null,
      tier: TIER_RANK[p.tier],
      interval: p.billing_interval,
      amount_cents: p.amount_cents,
      status: p.status,
      role: p.id === payerId ? "payer" : p.status === "ready" && p.stripe_payment_method_id ? "backup" : "waiting",
      position: p.id === payerId ? 0 : p.status === "ready" && p.stripe_payment_method_id ? ++backup : null,
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

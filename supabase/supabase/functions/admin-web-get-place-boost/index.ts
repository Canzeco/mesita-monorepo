// Supabase Edge Function — admin-web-get-place-boost
//
// MESITA-2789: Single Place › Boost, read-only. One place's paid tier and
// every backing behind it, so the operator can see who pays for what
// without opening Stripe: tier and factor, the pooled monthly-equivalent
// the live backings pay, and each backing's payer, tier, billing, status,
// period end and auto-renew. Test-mode backings say so (`livemode`).
//
// Nothing here writes: granting, cancelling or refunding a Boost is not an
// operator action in this cut.
//
// Body:     { placeId | projectId }
// Response: { ok: true, tier: 0..3, factor, monthly_cents, backers,
//             backings: AdminBacking[] }
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  json,
  readJson,
  readPlaceIdAlias,
  serveJson,
} from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { MEMBER_FALLBACK_NAME } from "../_shared/place-activity.ts";
import {
  BOOST_FACTOR,
  isLiveBacking,
  monthlyEquivalentCents,
  readBackerNames,
  readBoostPlace,
  type BoostInterval,
} from "../_shared/boost.ts";

serveJson("admin-web-get-place-boost", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const [placeRes, { data: rows, error }] = await Promise.all([
    readBoostPlace(admin, placeId),
    admin
      .from("place_backings")
      .select("id, consumer_id, tier, billing_interval, amount_cents, currency, status, current_period_end, cancel_at_period_end, show_name, livemode, created_at")
      .eq("place_id", placeId)
      .neq("status", "open")
      .order("created_at", { ascending: false }),
  ]);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (!placeRes.place) return json({ ok: false, error: "Place not found" }, 404);
  if (error) return json({ ok: false, error: `backings_read: ${error.message}` }, 500);

  const all = rows ?? [];
  const live = all.filter((r) => isLiveBacking(r));
  const payerIds = [...new Set(all.map((r) => r.consumer_id).filter((id): id is string => typeof id === "string"))];
  const names = await readBackerNames(admin, payerIds, MEMBER_FALLBACK_NAME);
  const nameById = new Map(payerIds.map((id, i) => [id, names[i]]));
  const tier = Math.min(Math.max(Number(placeRes.place.boost_tier) || 0, 0), 3) as 0 | 1 | 2 | 3;

  return json({
    ok: true,
    tier,
    factor: BOOST_FACTOR[tier],
    monthly_cents: Math.round(
      live.reduce((sum, r) => sum + monthlyEquivalentCents(r.amount_cents, r.billing_interval as BoostInterval), 0),
    ),
    backers: new Set(live.map((r) => r.consumer_id ?? r.id)).size,
    backings: all.map((r) => ({
      id: r.id,
      payer: r.consumer_id ? (nameById.get(r.consumer_id) ?? MEMBER_FALLBACK_NAME) : null,
      payer_id: r.consumer_id,
      tier: r.tier,
      interval: r.billing_interval,
      amount_cents: r.amount_cents,
      currency: r.currency,
      status: r.status,
      current_period_end: r.current_period_end,
      cancel_at_period_end: r.cancel_at_period_end,
      livemode: r.livemode,
      live: isLiveBacking(r),
      created_at: r.created_at,
    })),
  });
});

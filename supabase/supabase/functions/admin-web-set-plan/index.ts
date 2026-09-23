// Supabase Edge Function — admin-web-set-plan
//
// The admin door onto places.plan. A Stripe subscription is billing, not
// entitlement: places.plan is the single source of truth and can be granted
// through other doors (admin, partnership). This is that door.
//
// Grants or revokes a membership directly. No Stripe, no money, no
// place_subscriptions row — entitlement only. The admin console needs it
// because business-web-update-place deliberately rejects `plan` (it is
// billing, not profile), and the paid door is the place's yearly Mesita
// Membership (business-web-start-membership): owner-scoped to that one place,
// and it would open a real Stripe Checkout against someone else's place.
// (The earlier per-place checkout, business-web-change-subscription, was
// retired by MESITA-1889.)
//
// Deliberately NOT coupled to billing: if a place carries a live Stripe
// subscription, setting plan here changes entitlement and leaves that
// subscription alone — it will keep billing until it is cancelled through
// the paid door. Downgrading a paying place is an entitlement decision, not
// a refund. Same rule in reverse: granting `pro` here creates no
// subscription and charges nobody.
//
// Body: { placeId | projectId, plan?: "free" | "pro" | "ultra",
//         welcome_free_rate?, welcome_premium_rate?, free_rate?,
//         premium_rate?, monthly_promo_cap? }
//
// Two modes (MESITA-912):
//   • Join/drop — `plan` present: writes plan (+ optional rates). Join may
//     land on Zero (paid plan + null rates); partner/lane derives from both.
//   • Strategy switch — rates without `plan`: member-only rates write;
//     plan untouched; logs strategy_switch.
//
// Response: { ok: true, plan, place }  — `place` is the same AdminPlace
//           shape business-web-update-place returns, so the console can
//           reconcile its optimistic state from one call.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS } from "../_shared/place-columns.ts";
import { applyPromoRatesFromBody, hasPromoRatesInBody } from "../_shared/promo-rates.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";
import {
  applyListingTypeToPatch,
  clearActivationStamps,
  clearForfeitStamps,
  effectiveRatesAfterPatch,
} from "../_shared/partner-derivation.ts";
import { logStrategySwitch } from "../_shared/strategy-switch-log.ts";
import { type PlacePatch, writePlace } from "../_shared/place-doc.ts";

// public.membership — free | pro | ultra. `ultra` is legacy (no longer sold,
// MESITA-541) but still grantable for the places that already carry it.
const PLANS = ["free", "pro", "ultra"] as const;
type Plan = (typeof PLANS)[number];

type Body = {
  placeId?: unknown;
  projectId?: unknown;
  plan?: unknown;
  [key: string]: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const placeId = readPlaceIdAlias(body);
  if (!placeId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  const hasPlan = body.plan !== undefined && body.plan !== null;
  const hasRates = hasPromoRatesInBody(body);
  if (!hasPlan && !hasRates) {
    return json({ ok: false, error: "plan or promo rates are required" }, 400);
  }

  const { data: current, error: readCurrent } = await admin
    .from("places")
    .select(
      "plan, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, plan_forfeited_at",
    )
    .eq("id", placeId)
    .maybeSingle();
  if (readCurrent) {
    return json({ ok: false, error: `plan_read: ${readCurrent.message}` }, 500);
  }
  if (!current) {
    return json({ ok: false, error: "Place not found" }, 404);
  }
  const row = current as unknown as Record<string, unknown>;
  const currentPlan = (row.plan as string) ?? "free";

  const patch: Record<string, unknown> = {};
  const actor = authRes.user.email ?? authRes.user.id;

  // ── Strategy switch (rates only, no plan) ───────────────────────────────
  if (!hasPlan && hasRates) {
    if (currentPlan === "free") {
      return json(
        {
          ok: false,
          code: "not_a_member",
          error: "Strategy switching requires an active partnership.",
        },
        409,
      );
    }

    const ratesRes = applyPromoRatesFromBody(body, patch);
    if (!ratesRes.ok) return ratesRes.response;

    const fromRates = ratesFromPlace(row);
    applyListingTypeToPatch(patch, {
      plan: currentPlan,
      rates: effectiveRatesAfterPatch(row, patch),
      currentListingType: row.listing_type as string,
    });

    const updRes = await writePlace(admin, {
      table: "places",
      mode: "update",
      id: placeId,
      patch: patch as PlacePatch,
      select: "id",
      selectMode: "maybeSingle",
    });
    if (!updRes.ok) {
      return json({ ok: false, error: `plan_update: ${updRes.error}` }, 500);
    }
    if (!updRes.row) {
      return json({ ok: false, error: "Place not found" }, 404);
    }

    logStrategySwitch({
      project: placeId,
      from: fromRates,
      to: effectiveRatesAfterPatch(row, patch),
      actor,
    });

    const { data: place, error: readError } = await admin
      .from("profiles")
      .select(PLACE_BUSINESS_COLUMNS)
      .eq("id", placeId)
      .single();
    if (readError) {
      return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
    }

    return json({ ok: true, plan: currentPlan, place });
  }

  // ── Join / drop (plan present) ──────────────────────────────────────────
  if (!PLANS.includes(body.plan as Plan)) {
    return json(
      { ok: false, error: `plan must be one of ${PLANS.join(" | ")}` },
      400,
    );
  }
  const plan = body.plan as Plan;
  patch.plan = plan;

  const ratesRes = applyPromoRatesFromBody(body, patch);
  if (!ratesRes.ok) return ratesRes.response;

  const effectivePlan = plan;
  const effectiveRates = effectiveRatesAfterPatch(row, patch);

  applyListingTypeToPatch(patch, {
    plan: effectivePlan,
    rates: effectiveRates,
    currentListingType: row.listing_type as string,
  });

  // T10 — admin re-grant after forfeit restarts pending activation.
  if (plan !== "free" && row.plan_forfeited_at) clearForfeitStamps(patch);

  // T13 — voluntary drop clears activation stamps for a fresh re-join.
  if (plan === "free") clearActivationStamps(patch);

  const updRes = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: placeId,
    patch: patch as PlacePatch,
    select: "id",
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) {
    return json({ ok: false, error: `plan_update: ${updRes.error}` }, 500);
  }
  if (!updRes.row) {
    return json({ ok: false, error: "Place not found" }, 404);
  }

  const { data: place, error: readError } = await admin
    .from("profiles")
    .select(PLACE_BUSINESS_COLUMNS)
    .eq("id", placeId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, plan, place });
});

// Supabase Edge Function — admin-web-set-plan
//
// The admin door onto projects.plan. business-web-change-subscription puts
// it this way: "A Stripe subscription is billing, not entitlement:
// projects.plan is the single source of truth and can be granted through
// other doors (admin, partnership)." This is that door.
//
// Grants or revokes a membership directly. No Stripe, no money, no
// project_subscriptions row — entitlement only. The admin console needs it
// because business-web-update-project deliberately rejects `plan` (it is
// billing, not profile), and business-web-change-subscription is the paid
// door: owner-scoped and, once live-mode ships, it would open a real Stripe
// Checkout against someone else's place.
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
//           shape business-web-update-project returns, so the console can
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
import { normalisePromoRate, PROMO_RATE_FIELDS } from "../_shared/promo-rates.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";
import {
  applyListingTypeToPatch,
  effectiveRatesAfterPatch,
} from "../_shared/partner-derivation.ts";
import { logStrategySwitch } from "../_shared/strategy-switch-log.ts";
import { type ProjectPatch, writePlace } from "../_shared/place-doc.ts";

// public.membership — free | pro | ultra. `ultra` is legacy (no longer sold,
// MESITA-541) but still grantable for the places that already carry it.
const PLANS = ["free", "pro", "ultra"] as const;
type Plan = (typeof PLANS)[number];

const LEGAL_CAPS = [200, 500, 1000];

type Body = {
  placeId?: unknown;
  projectId?: unknown;
  plan?: unknown;
  [key: string]: unknown;
};

function hasRatesInBody(body: Body): boolean {
  return PROMO_RATE_FIELDS.some((f) => f in body) || "monthly_promo_cap" in body;
}

function applyRatesFromBody(
  body: Body,
  patch: Record<string, unknown>,
): { ok: true } | { ok: false; response: Response } {
  for (const field of PROMO_RATE_FIELDS) {
    if (!(field in body)) continue;
    const rate = normalisePromoRate(field, body[field]);
    if (!rate.ok) return { ok: false, response: json({ ok: false, error: rate.error }, 400) };
    patch[field] = rate.value;
  }
  if ("monthly_promo_cap" in body) {
    const raw = body.monthly_promo_cap;
    if (raw == null) {
      patch.monthly_promo_cap = null;
    } else if (!LEGAL_CAPS.includes(Number(raw))) {
      return {
        ok: false,
        response: json(
          {
            ok: false,
            error: `monthly_promo_cap must be null or one of ${LEGAL_CAPS.join(", ")}`,
          },
          400,
        ),
      };
    } else {
      patch.monthly_promo_cap = Number(raw);
    }
  }
  return { ok: true };
}

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

  const projectId = readPlaceIdAlias(body);
  if (!projectId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  const hasPlan = body.plan !== undefined && body.plan !== null;
  const hasRates = hasRatesInBody(body);
  if (!hasPlan && !hasRates) {
    return json({ ok: false, error: "plan or promo rates are required" }, 400);
  }

  const { data: current, error: readCurrent } = await admin
    .from("projects")
    .select(
      "plan, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, plan_forfeited_at",
    )
    .eq("id", projectId)
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

    const ratesRes = applyRatesFromBody(body, patch);
    if (!ratesRes.ok) return ratesRes.response;

    const fromRates = ratesFromPlace(row);
    applyListingTypeToPatch(patch, {
      plan: currentPlan,
      rates: effectiveRatesAfterPatch(row, patch),
      currentListingType: row.listing_type as string,
    });

    const updRes = await writePlace(admin, {
      table: "projects",
      mode: "update",
      id: projectId,
      patch: patch as ProjectPatch,
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
      project: projectId,
      from: fromRates,
      to: effectiveRatesAfterPatch(row, patch),
      actor,
    });

    const { data: place, error: readError } = await admin
      .from("profiles")
      .select(PLACE_BUSINESS_COLUMNS)
      .eq("id", projectId)
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

  const ratesRes = applyRatesFromBody(body, patch);
  if (!ratesRes.ok) return ratesRes.response;

  const effectivePlan = plan;
  const effectiveRates = effectiveRatesAfterPatch(row, patch);

  applyListingTypeToPatch(patch, {
    plan: effectivePlan,
    rates: effectiveRates,
    currentListingType: row.listing_type as string,
  });

  // T10 — admin re-grant after forfeit restarts pending activation.
  if (plan !== "free" && row.plan_forfeited_at) {
    patch.plan_forfeited_at = null;
    patch.strike_count = 0;
    patch.promo_paused_until = null;
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;
  }

  // T13 — voluntary drop clears activation stamps for a fresh re-join.
  if (plan === "free") {
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;
  }

  const updRes = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: projectId,
    patch: patch as ProjectPatch,
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
    .eq("id", projectId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, plan, place });
});

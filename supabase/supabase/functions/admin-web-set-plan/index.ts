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
// Body: { placeId | projectId, plan: "free" | "pro" | "ultra",
//         welcome_free_rate?, welcome_premium_rate?, free_rate?,
//         premium_rate?, monthly_promo_cap? }
// Response: { ok: true, plan, place }  — `place` is the same AdminPlace
//           shape business-web-update-project returns, so the console can
//           reconcile its optimistic state from one call.
//
// The rates are optional but they belong here: a membership and the discount
// strategy that justifies it are ONE decision (MESITA-818). Sent together they
// land in a single UPDATE, which is what lets this EF enforce the invariant
// below — a paid plan whose rates don't match a preset would be a partner
// giving 0%, which is worse than not being a partner at all.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS } from "../_shared/place-columns.ts";
import { normalisePromoRate, PROMO_RATE_FIELDS } from "../_shared/promo-rates.ts";
import { strategyForRates } from "../_shared/lineup-strategy.ts";

// public.membership — free | pro | ultra. `ultra` is legacy (no longer sold,
// MESITA-541) but still grantable for the places that already carry it.
const PLANS = ["free", "pro", "ultra"] as const;
type Plan = (typeof PLANS)[number];

const LEGAL_CAPS = [200, 500, 1000, 2000];

type Body = {
  placeId?: unknown;
  projectId?: unknown;
  plan?: unknown;
  [key: string]: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

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
  if (!PLANS.includes(body.plan as Plan)) {
    return json(
      { ok: false, error: `plan must be one of ${PLANS.join(" | ")}` },
      400,
    );
  }
  const plan = body.plan as Plan;

  // MESITA-818 — plan is also the VERIFIED-PARTNER switch.
  //
  // Until now this EF wrote `plan` and nothing else, and no other EF or UI in
  // the repo ever wrote `listing_type` at all: `_shared/save-place.ts`
  // hardcodes 'web' on create, and the only 'partner' anywhere was the local
  // seed row. So every place in production was born 'web' and stayed 'web'
  // forever — while the consumer side gates the ENTIRE reward program on
  // `listing_type === 'partner'` (rewards New tab, consumer-web-create-ticket's
  // 409 not_partner, the venue pass, Mesita Check). An admin could put a place
  // on a paid strategy with real rates and the guest would still see "Soon".
  //
  // Entitlement and listing are therefore one decision, made here: a paid
  // membership IS Verified Partner status. Demotion is the mirror — dropping
  // to Zero returns the place to the plain catalog listing. 'unclaimed' is
  // left alone on demotion: it means "we have not heard from this venue",
  // which a plan change doesn't answer.
  const { data: current, error: readCurrent } = await admin
    .from("projects")
    // Literal, not PROMO_RATE_FIELDS.join(): supabase-js parses the select
    // string at the TYPE level, so an interpolated one resolves to a
    // ParserError instead of a row shape.
    .select(
      "listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
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

  const patch: Record<string, unknown> = { plan };

  // Rates ride along when the caller sends them. Same legal set as
  // business-web-update-project — one validator, so the two doors can't drift.
  for (const field of PROMO_RATE_FIELDS) {
    if (!(field in body)) continue;
    const rate = normalisePromoRate(field, body[field]);
    if (!rate.ok) return json({ ok: false, error: rate.error }, 400);
    patch[field] = rate.value;
  }
  if ("monthly_promo_cap" in body) {
    const raw = body.monthly_promo_cap;
    if (raw == null) {
      patch.monthly_promo_cap = null;
    } else if (!LEGAL_CAPS.includes(Number(raw))) {
      return json(
        {
          ok: false,
          error: `monthly_promo_cap must be null or one of ${LEGAL_CAPS.join(", ")}`,
        },
        400,
      );
    } else {
      patch.monthly_promo_cap = Number(raw);
    }
  }

  // The rates this place will have AFTER this write — incoming where sent,
  // stored otherwise. That's what the invariant has to judge, not the stored
  // row alone: on a join the rates arrive in this very body.
  const effectiveRates = {
    welcome_free_rate: null,
    welcome_premium_rate: null,
    free_rate: null,
    premium_rate: null,
  } as Record<string, number | null>;
  for (const field of PROMO_RATE_FIELDS) {
    const v = field in patch ? patch[field] : row[field];
    effectiveRates[field] = v == null ? null : Number(v);
  }

  // INVARIANT (MESITA-818): a paid plan must resolve to a real strategy.
  //
  // `placeStrategy()` matches the four rates against exact presets; anything
  // else — all-null, or a hand-edited custom grid — falls to `zero`, i.e. 0%
  // off. A Verified Partner at 0% is the worst outcome available: the guest
  // sees an unlocked reward lane, opens a ticket, and gets nothing. Refuse
  // the grant instead, and say which grid would have worked.
  if (plan !== "free") {
    const strategy = strategyForRates(
      effectiveRates as unknown as Parameters<typeof strategyForRates>[0],
    );
    if (strategy == null || strategy === "zero") {
      return json(
        {
          ok: false,
          code: "no_strategy",
          error:
            "A paid plan needs a promo strategy: send the four rates with it " +
            "(conservative 20/30/10/20 · aggressive 30/50/10/30 · dominant " +
            "40/50/20/30). Granting it with no matching grid would make this " +
            "a Verified Partner that gives 0%.",
        },
        409,
      );
    }
  }

  // Verified Partner tracks the paid membership, both ways.
  if (plan !== "free") {
    if (row.listing_type !== "partner") patch.listing_type = "partner";
  } else if (row.listing_type === "partner") {
    patch.listing_type = "web";
  }

  // plan is a `projects` column — write it where the other two plan writers
  // do (business-web-change-subscription's mock grant, stripe-webhook-handle-
  // event), not through projects_view.
  const { data: updated, error } = await admin
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) {
    return json({ ok: false, error: `plan_update: ${error.message}` }, 500);
  }
  if (!updated) {
    return json({ ok: false, error: "Place not found" }, 404);
  }

  // Re-read through the view so the console gets the same AdminPlace shape
  // business-web-update-project hands back.
  const { data: place, error: readError } = await admin
    .from("projects_view")
    .select(PLACE_BUSINESS_COLUMNS)
    .eq("id", projectId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, plan, place });
});

// Supabase Edge Function — business-web-set-partnership
//
// The OPERATOR's door onto a place's Partnership. `admin-web-set-plan` is
// the super-admin entitlement door and accepts any plan value (including
// legacy ultra). A plain twin would let a client grant itself Verified
// (`plan=pro`) — `business-web-update-place` rejects a `plan` key for that
// reason. This door never takes a `plan` field (MESITA-1740).
//
// Actions:
//   join     — free partnership join. Writes plan=pro internally, plus
//              the rates that ride along (MESITA-818/912: partnership and
//              the strategy that justifies it are one atomic write).
//              Allowed from free or forfeited. Refuses if already a member.
//   drop     — voluntary drop to free. Clears activation stamps.
//   strategy — rates-only switch. Member-only; plan untouched.
//
// Auth: requireEditor — the Capabilities tab is every held role except
// viewer, and this is that tab's writer.
//
// Body: { placeId | projectId, action: "join" | "drop" | "strategy",
//         welcome_free_rate?, welcome_premium_rate?, free_rate?,
//         premium_rate?, monthly_promo_cap? }
// Response: { ok: true, plan, place }
//
// Local:  supabase functions serve business-web-set-partnership
// Deploy: supabase functions deploy business-web-set-partnership

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireEditor,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS } from "../_shared/place-columns.ts";
import { normalisePromoRate, PROMO_RATE_FIELDS } from "../_shared/promo-rates.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";
import {
  applyListingTypeToPatch,
  effectiveRatesAfterPatch,
} from "../_shared/partner-derivation.ts";
import { logStrategySwitch } from "../_shared/strategy-switch-log.ts";
import { type PlacePatch, writePlace } from "../_shared/place-doc.ts";

const LEGAL_CAPS = [200, 500, 1000];
const ACTIONS = ["join", "drop", "strategy"] as const;
type Action = (typeof ACTIONS)[number];

type Body = {
  placeId?: unknown;
  projectId?: unknown;
  action?: unknown;
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

async function readPlaceAfterWrite(
  admin: ReturnType<typeof adminClient>,
  placeId: string,
): Promise<Response> {
  const { data: place, error: readError } = await admin
    .from("profiles")
    .select(PLACE_BUSINESS_COLUMNS)
    .eq("id", placeId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }
  const plan = (place as { plan?: string } | null)?.plan ?? "free";
  return json({ ok: true, plan, place });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  // The hole this door exists not to open: a client-chosen plan value.
  if ("plan" in body && body.plan !== undefined) {
    return json(
      {
        ok: false,
        code: "plan_not_accepted",
        error: "This door does not take a plan. Use action join, drop, or strategy.",
      },
      400,
    );
  }

  const placeId = readPlaceIdAlias(body);
  if (!placeId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  const action = (typeof body.action === "string" ? body.action : "").trim();
  if (!ACTIONS.includes(action as Action)) {
    return json(
      { ok: false, error: `action must be one of ${ACTIONS.join(" | ")}` },
      400,
    );
  }

  const admin = adminClient(envRes.env);
  const roleRes = await requireEditor(
    admin,
    authRes.user,
    placeId,
    "Only this place's owners and editors can change Partnership.",
  );
  if (!roleRes.ok) return roleRes.response;

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
  const actor = authRes.user.email ?? authRes.user.id;
  const patch: Record<string, unknown> = {};

  if (action === "strategy") {
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
    if (!hasRatesInBody(body)) {
      return json({ ok: false, error: "promo rates are required" }, 400);
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
    return await readPlaceAfterWrite(admin, placeId);
  }

  const joining = action === "join";
  const nextPlan = joining ? "pro" : "free";

  if (joining && currentPlan !== "free" && !row.plan_forfeited_at) {
    return json(
      {
        ok: false,
        code: "already_a_member",
        error: "This place already holds a partnership.",
      },
      409,
    );
  }
  if (!joining && currentPlan === "free") {
    return json(
      {
        ok: false,
        code: "not_a_member",
        error: "This place is not in the partnership.",
      },
      409,
    );
  }

  patch.plan = nextPlan;
  const ratesRes = applyRatesFromBody(body, patch);
  if (!ratesRes.ok) return ratesRes.response;

  applyListingTypeToPatch(patch, {
    plan: nextPlan,
    rates: effectiveRatesAfterPatch(row, patch),
    currentListingType: row.listing_type as string,
  });

  if (joining && row.plan_forfeited_at) {
    patch.plan_forfeited_at = null;
    patch.strike_count = 0;
    patch.promo_paused_until = null;
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;
  }
  if (!joining) {
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;
  }

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

  return await readPlaceAfterWrite(admin, placeId);
});

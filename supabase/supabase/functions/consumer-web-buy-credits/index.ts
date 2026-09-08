// Supabase Edge Function — consumer-web-buy-credits (MESITA-1676)
//
// Naming: caller-verb-words. Caller = consumer, verb = buy, words = credits.
//
// Charges the guest's saved platform card, cloned onto the target place's
// ORGANIZATION's connected Stripe account — a DIRECT charge
// (_shared/mesita-pay-charge.ts): the organization is merchant of record,
// Mesita never enters the funds flow. Writes a credit_lots row (org-scoped,
// spendable at any of that organization's places) through the
// create_credit_lot RPC (MESITA-1671).
//
// THE CLIENT NEVER SENDS MONEY TERMS. bonus_cents, activates_at and
// expires_at are resolved SERVER-side from controls_config and pinned the
// moment the charge is confirmed — a body carrying any of them, or an
// inflated/negative paidCents, or an organization_id, is simply never read.
// paidCents is the one number the client picks, and it must be one of
// CREDIT_PACKAGE_CENTS or the request never reaches Stripe.
//
// TWO WRITERS, ONE ROW. This EF is "the confirm reader": when the charge
// confirms synchronously (the common case), it calls create_credit_lot
// itself. stripe-webhook-handle-event's Connect branch is the backstop for
// the rare crash between Stripe confirming and this call running, or for a
// requires_action challenge the guest finishes after this request already
// returned — it replays the SAME call from the PaymentIntent's own metadata.
// credit_lots.stripe_payment_intent_id's partial unique index is what makes
// two writers safe: the loser gets 23505 inside the RPC and hands back the
// lot the winner already created (schema comment, 20260908101212).
//
// IDEMPOTENCY KEY: `credits-buy:<consumerId>:<requestId>`, never a value
// derived from connectApiVersion() or any other env-overridable Stripe
// setting. Stripe scopes idempotency keys per API version it receives
// (stripe-connect.ts's connectAccountIdempotencyKey comment names the same
// hazard for accounts.create); this charge uses the ordinary, non-overridable
// STRIPE_API_VERSION for exactly that reason — an operator rolling
// STRIPE_CONNECT_API_VERSION for the Connect onboarding path must never be
// able to turn a credits retry into a second real charge. `requestId` is
// minted by the CLIENT once per purchase attempt and resent verbatim on any
// retry of the same attempt; a caller that omits it gets a server-minted one,
// which only degrades retry-safety back to "no worse than not having this at
// all" — the DB unique index is still the actual guarantee against a double
// LOT regardless.
//
// GATES, IN ORDER: cardsMockMode(stripeKey) first, then liveChargesBlocked —
// the order consumer-web-select-ticket-payment already uses. UNLIKE the
// ticket rail, mock mode does not block here: a Credits purchase has no
// at_place fallback to steer toward, so with no Stripe key at all this walks
// the whole flow and writes a real lot against a synthetic mock_pi_ intent id
// — the same "walkable with no key" posture consumer-web-add-card takes,
// applied to a purchase instead of a card save.
//
// CREDITS ACTIVATE IMMEDIATELY (Pato, 2026-09-08) — a decision made AFTER
// this issue's own text, which asks for "the exact activation clock time
// above the confirm." Two files shipped the same day and independently say
// otherwise, in Pato's own words quoted in both: apps/web-consumer's
// BuyClient.tsx ("THE HOLD IS NOT ON THIS SCREEN... Credits are active the
// moment they are bought now") and src/lib/mock/{credits-mock,use-credits}.ts
// ("Both [the hold and its demo clock] are gone... Buying is activation").
// `activates_at` below is therefore `now`, not `now + resolveHoldHours(...)`
// — the schema's own constraint only requires expires_at > activates_at, not
// a gap, so this satisfies it without applying a hold. `defaultHoldHours`
// keeps riding controls_config and the guest policy payload for when the
// term returns (the mock's own words: "nothing on this surface reads it"),
// so the knob is left intact rather than deleted — only UNAPPLIED here. This
// is a judgment call made from stronger, later, independently-corroborated
// evidence than the issue text; flagged prominently in the PR description.
//
// Body:     { placeId, paidCents, requestId? }
// Response: { ok: true, state: "purchased", lotId, mock?: true }
//         | { ok: true, state: "requires_action", requiresAction }
//         | 400 | 402 | 409 | 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";
import { resolveChargeableOrganizationForCredits } from "../_shared/credits-readiness.ts";
import { chargeCreditsWithMesitaPay } from "../_shared/mesita-pay-charge.ts";
import {
  ensureConsumerCustomer,
  liveChargesBlocked,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import { cardsMockMode, defaultPaymentMethodId } from "../_shared/consumer-cards.ts";
import { stripePublishableKey, stripeSecretKey } from "../_shared/stripe-env.ts";
import { loadControlsConfig, resolveExpiryDays } from "../_shared/controls-config.ts";
import { isCreditPackageAmount } from "../_shared/credits-packages.ts";

type Body = { placeId?: unknown; paidCents?: unknown; requestId?: unknown };

const DAY_MS = 86_400_000;
// Loose on purpose: this only needs to be STABLE across a retry, not a real
// UUID — a hostile value just becomes part of an idempotency key string, and
// Stripe caps that at 255 chars regardless.
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

async function resolveOrganizationCurrency(
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
): Promise<string> {
  const { data } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", organizationId)
    .maybeSingle();
  const currency = (data as { currency?: string | null } | null)?.currency;
  return currency && currency.trim() ? currency.toUpperCase() : "MXN";
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

  const placeId = typeof bodyRes.body.placeId === "string"
    ? bodyRes.body.placeId.trim()
    : "";
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  // The ONLY money term the client picks, and only from the allowlist —
  // this is also what rejects an inflated or negative paidCents: neither is
  // ever one of CREDIT_PACKAGE_CENTS.
  if (!isCreditPackageAmount(bodyRes.body.paidCents)) {
    return json(
      { ok: false, error: "paidCents must be one of the offered packages" },
      400,
    );
  }
  const paidCents = bodyRes.body.paidCents;

  const rawRequestId = typeof bodyRes.body.requestId === "string"
    ? bodyRes.body.requestId.trim()
    : "";
  if (rawRequestId && !REQUEST_ID_RE.test(rawRequestId)) {
    return json({ ok: false, error: "requestId is malformed" }, 400);
  }
  const requestId = rawRequestId || crypto.randomUUID();

  const admin = adminClient(envRes.env);

  const visitsConfig = await loadVisitsConfig(admin);
  const chargeable = await resolveChargeableOrganizationForCredits(
    admin,
    visitsConfig.payCredits,
    placeId,
  );
  if (!chargeable) {
    return json(
      {
        ok: false,
        code: "not_chargeable",
        error: "Mesita Credits aren't available at this place.",
      },
      409,
    );
  }

  const config = await loadControlsConfig(admin);
  const now = new Date();
  const expiryDays = resolveExpiryDays(config, null);
  const bonusCents = Math.round(paidCents * (config.defaultBonusPct / 100));
  // now, not now + a hold — see the file header's "CREDITS ACTIVATE
  // IMMEDIATELY" note. The schema's own check (expires_at > activates_at)
  // does not require a gap, only an order.
  const activatesAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + expiryDays * DAY_MS).toISOString();
  const currency = await resolveOrganizationCurrency(admin, chargeable.organizationId);

  const stripeKey = stripeSecretKey();

  // MOCK MODE: no at_place fallback exists for a purchase, so — unlike the
  // ticket rail — this walks the whole flow with a synthetic intent id
  // instead of blocking. Same posture as consumer-web-add-card's mock path.
  if (cardsMockMode(stripeKey)) {
    const mockIntentId = `mock_pi_${crypto.randomUUID()}`;
    const lot = await admin.rpc("create_credit_lot", {
      p_organization_id: chargeable.organizationId,
      p_consumer_id: authRes.user.id,
      p_paid_cents: paidCents,
      p_bonus_cents: bonusCents,
      p_currency: currency,
      p_activates_at: activatesAt,
      p_expires_at: expiresAt,
      p_stripe_payment_intent_id: mockIntentId,
    });
    if (lot.error) {
      return json(
        { ok: false, error: `credit_lot_mock: ${lot.error.message}` },
        500,
      );
    }
    const result = lot.data as { ok: boolean; lotId?: string } | null;
    return json({
      ok: true,
      mock: true,
      state: "purchased",
      lotId: result?.lotId,
      activatesAt,
      expiresAt,
      bonusCents,
    });
  }

  const liveBlock = liveChargesBlocked(stripeKey!);
  if (liveBlock) {
    return json({ ok: false, error: liveBlock, code: "stripe_live_blocked" }, 409);
  }

  const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });
  const platformCustomerId = await ensureConsumerCustomer(
    admin,
    stripe,
    authRes.user.id,
  );
  const paymentMethodId = await defaultPaymentMethodId(stripe, platformCustomerId);
  if (!paymentMethodId) {
    return json(
      {
        ok: false,
        code: "no_card",
        error: "Add a card in Me › Cards before buying Credits.",
      },
      409,
    );
  }

  const outcome = await chargeCreditsWithMesitaPay(stripe, admin, {
    organizationId: chargeable.organizationId,
    connectedAccountId: chargeable.connectedAccountId,
    consumerId: authRes.user.id,
    platformCustomerId,
    platformPaymentMethodId: paymentMethodId,
    paidCents,
    bonusCents,
    currency,
    activatesAt,
    expiresAt,
    idempotencyKey: `credits-buy:${authRes.user.id}:${requestId}`,
  });

  // THE BANK WANTS A STEP (MESITA-1670 pattern). No lot exists yet — the
  // intent isn't confirmed — so nothing rolls back here; there is nothing to
  // roll back. The webhook backstop finishes the job from intent.metadata
  // once the guest completes the challenge, even if they never return here.
  if (!outcome.ok && outcome.code === "requires_action") {
    const publishableKey = stripePublishableKey();
    if (!publishableKey) {
      console.error(
        "credits-buy 3DS: no STRIPE_PUBLISHABLE_KEY for the active mode; " +
          `intent ${outcome.action.paymentIntentId} left unconfirmed`,
      );
      return json(
        {
          ok: false,
          code: "requires_action",
          error: "Your bank needs extra verification for this card — try again shortly.",
        },
        402,
      );
    }
    return json({
      ok: true,
      state: "requires_action",
      requiresAction: { ...outcome.action, publishableKey },
    });
  }

  if (!outcome.ok) {
    return json({ ok: false, code: outcome.code, error: outcome.error }, 402);
  }

  // "The confirm reader" — the charge just succeeded synchronously in THIS
  // request, so this call writes the lot itself rather than waiting on the
  // webhook. create_credit_lot is idempotent on stripe_payment_intent_id: if
  // the webhook backstop somehow wins the race first, this returns the SAME
  // lot rather than a second one.
  const lot = await admin.rpc("create_credit_lot", {
    p_organization_id: chargeable.organizationId,
    p_consumer_id: authRes.user.id,
    p_paid_cents: paidCents,
    p_bonus_cents: bonusCents,
    p_currency: currency,
    p_activates_at: activatesAt,
    p_expires_at: expiresAt,
    p_stripe_payment_intent_id: outcome.paymentIntentId,
  });
  if (lot.error) {
    // The charge succeeded — never tell the guest the purchase failed. The
    // webhook backstop will still create this lot from payment_intent.
    // succeeded's metadata; this response only says a human should look if
    // it doesn't appear.
    return json(
      {
        ok: false,
        code: "charged_pending_lot",
        error:
          `Payment succeeded but recording it failed: ${lot.error.message}. It will finish automatically — refresh shortly.`,
      },
      500,
    );
  }
  const result = lot.data as { ok: boolean; lotId?: string } | null;
  return json({
    ok: true,
    state: "purchased",
    lotId: result?.lotId,
    activatesAt,
    expiresAt,
    bonusCents,
  });
});

// Supabase Edge Function — consumer-web-gift-credits (MESITA-1677)
//
// Naming: caller-verb-words. Caller = consumer, verb = gift, words = credits.
//
// Charges the SENDER's saved platform card, cloned onto the target place's
// ORGANIZATION's connected Stripe account — the exact same direct-charge
// mechanics as consumer-web-buy-credits, through
// chargeGiftCreditsWithMesitaPay (_shared/mesita-pay-charge.ts). What
// differs from Buy: the resulting lot has NO owner (consumer_id NULL) —
// GIFTING IS ISSUANCE, NOT TRANSFER (MESITA-1677, restating MESITA-1380's
// no-transfers-between-consumers exclusion): the sender's own balance is
// never touched, a fresh lot is minted instead, addressed by a hashed claim
// code until someone redeems it.
//
// THE CODE IS DRAWN *BEFORE* THE CHARGE, NOT AFTER — this is load-bearing,
// not incidental. chargeGiftCreditsWithMesitaPay stamps `gift_code_hash` on
// the PaymentIntent's own metadata so the webhook backstop
// (credit-payment-intent.ts) can reconstruct the identical create_credit_gift
// call later; if the code were drawn only after a successful charge, the
// intent's metadata would carry no real code_hash for that backstop to read.
// So this EF checks the drawn code's hash for a LIVE collision (a plain
// SELECT, no charge yet) before ever calling Stripe, retrying the draw a
// bounded number of times — cheap, and it means the code Stripe's metadata
// ends up carrying is (barring an actual race in the gap between this check
// and the insert) the SAME one create_credit_gift will accept.
//
// THE CODE IS SHOWN EXACTLY ONCE, HERE. It is never stored — only its keyed
// HMAC digest (_shared/gift-code.ts) lands in credit_gifts.code_hash. If the
// response is lost (dropped connection, closed tab before the "Gift sent"
// screen renders), the code cannot be recovered: the sender must cancel the
// gift from "Gifts you sent" (consumer-web-cancel-credit-gift) to get the
// lot back. The lot itself is not lost — the webhook backstop still writes
// it from the PaymentIntent's own metadata even if this response never
// arrives; only the plaintext code is gone with the dropped response.
//
// TWO EXPIRIES: `claimExpiresAt` (how long the CODE stays claimable) and
// `expiryDays` (the credit-SPEND term, frozen here, applied to the lot at
// claim/cancel time — "the clock starts when the code becomes money").
// GIFT_CLAIM_WINDOW_DAYS is a judgment call, not a controls_config knob:
// there is no operator-facing "how long may a gift sit unclaimed" field yet,
// so this ships a generous, code-owned default (180 days) rather than
// blocking on a config surface the issue never asked for. A dedicated knob
// is a clean follow-up.
//
// GATES, IN ORDER: identical to consumer-web-buy-credits —
// cardsMockMode(stripeKey) first (mock mode still walks the whole flow and
// writes a real, claimable gift against a synthetic intent id — a gift has
// no at_place fallback either), then liveChargesBlocked.
//
// CREDITS ACTIVATE IMMEDIATELY once CLAIMED (Pato, 2026-09-08, per
// consumer-web-buy-credits' own header) — there is no hold on the lot's
// activates_at once redeem_credit_gift sets it. Nothing here applies a hold.
//
// Body:     { placeId, paidCents, note?, requestId? }
// Response: { ok: true, state: "purchased", giftId, code, expiresAt, expiryDays, bonusCents, mock? }
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
import { chargeGiftCreditsWithMesitaPay } from "../_shared/mesita-pay-charge.ts";
import {
  ensureConsumerCustomer,
  liveChargesBlocked,
  STRIPE_API_VERSION,
} from "../_shared/stripe-billing.ts";
import {
  cardsMockMode,
  defaultPaymentMethodId,
} from "../_shared/consumer-cards.ts";
import {
  stripePublishableKey,
  stripeSecretKey,
} from "../_shared/stripe-env.ts";
import {
  loadControlsConfig,
  resolveExpiryDays,
} from "../_shared/controls-config.ts";
import { isCreditPackageAmount } from "../_shared/credits-packages.ts";
import { generateGiftCode, hashGiftCode } from "../_shared/gift-code.ts";

type Body = {
  placeId?: unknown;
  paidCents?: unknown;
  note?: unknown;
  requestId?: unknown;
};

const DAY_MS = 86_400_000;
const NOTE_MAX_LENGTH = 140; // matches credit_gifts_note_length and GiftClient.tsx's textarea maxLength
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
// No controls_config knob for this yet — see header comment.
const GIFT_CLAIM_WINDOW_DAYS = 180;
const MAX_CODE_DRAW_ATTEMPTS = 5;

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

/**
 * Draws a code whose hash is not already a LIVE (unclaimed) gift, checked
 * with a plain SELECT before any Stripe call. This is optimistic — a true
 * race in the gap between this check and create_credit_gift's own insert is
 * still possible in principle — but at 10 digits keyed-HMAC space it is the
 * right amount of engineering for a failure mode this rare, and the RPC
 * itself is still the authoritative, race-safe guard (see its own comment).
 */
async function drawUnusedGiftCode(
  admin: ReturnType<typeof adminClient>,
  serviceRoleKey: string,
): Promise<{ code: string; codeHash: string } | null> {
  for (let attempt = 0; attempt < MAX_CODE_DRAW_ATTEMPTS; attempt += 1) {
    const code = generateGiftCode();
    const codeHash = await hashGiftCode(code, serviceRoleKey);
    const existing = await admin
      .from("credit_gifts")
      .select("id")
      .eq("code_hash", codeHash)
      .eq("state", "unclaimed")
      .maybeSingle();
    if (!existing.data) return { code, codeHash };
  }
  return null;
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
  // same rule as consumer-web-buy-credits.
  if (!isCreditPackageAmount(bodyRes.body.paidCents)) {
    return json(
      { ok: false, error: "paidCents must be one of the offered packages" },
      400,
    );
  }
  const paidCents = bodyRes.body.paidCents;

  let note: string | null = null;
  if (typeof bodyRes.body.note === "string") {
    const trimmed = bodyRes.body.note.trim();
    if (trimmed.length > NOTE_MAX_LENGTH) {
      return json({ ok: false, error: "note is too long" }, 400);
    }
    note = trimmed || null;
  }

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

  const drawn = await drawUnusedGiftCode(admin, envRes.env.serviceKey);
  if (!drawn) {
    return json(
      { ok: false, error: "Could not generate a gift code — try again." },
      500,
    );
  }
  const { code, codeHash } = drawn;

  const config = await loadControlsConfig(admin);
  const now = new Date();
  const expiryDays = resolveExpiryDays(config, null);
  const bonusCents = Math.round(paidCents * (config.defaultBonusPct / 100));
  const claimExpiresAt = new Date(
    now.getTime() + GIFT_CLAIM_WINDOW_DAYS * DAY_MS,
  ).toISOString();
  const currency = await resolveOrganizationCurrency(
    admin,
    chargeable.organizationId,
  );

  const stripeKey = stripeSecretKey();

  // MOCK MODE: same posture as consumer-web-buy-credits — no at_place
  // fallback exists, so this walks the whole flow with a synthetic intent id.
  if (cardsMockMode(stripeKey)) {
    const mockIntentId = `mock_pi_${crypto.randomUUID()}`;
    const created = await admin.rpc("create_credit_gift", {
      p_organization_id: chargeable.organizationId,
      p_sender_id: authRes.user.id,
      p_paid_cents: paidCents,
      p_bonus_cents: bonusCents,
      p_currency: currency,
      p_code_hash: codeHash,
      p_claim_expires_at: claimExpiresAt,
      p_expiry_days: expiryDays,
      p_note: note,
      p_stripe_payment_intent_id: mockIntentId,
    });
    if (created.error) {
      return json(
        { ok: false, error: `credit_gift_mock: ${created.error.message}` },
        500,
      );
    }
    const result = created.data as { ok: boolean; giftId?: string } | null;
    return json({
      ok: true,
      mock: true,
      state: "purchased",
      giftId: result?.giftId,
      code,
      expiresAt: claimExpiresAt,
      expiryDays,
      bonusCents,
    });
  }

  const liveBlock = liveChargesBlocked(stripeKey!);
  if (liveBlock) {
    return json(
      { ok: false, error: liveBlock, code: "stripe_live_blocked" },
      409,
    );
  }

  const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });
  const platformCustomerId = await ensureConsumerCustomer(
    admin,
    stripe,
    authRes.user.id,
  );
  const paymentMethodId = await defaultPaymentMethodId(
    stripe,
    platformCustomerId,
  );
  if (!paymentMethodId) {
    return json(
      {
        ok: false,
        code: "no_card",
        error: "Add a card in Me › Cards before gifting Credits.",
      },
      409,
    );
  }

  const outcome = await chargeGiftCreditsWithMesitaPay(stripe, admin, {
    organizationId: chargeable.organizationId,
    connectedAccountId: chargeable.connectedAccountId,
    senderId: authRes.user.id,
    platformCustomerId,
    platformPaymentMethodId: paymentMethodId,
    paidCents,
    bonusCents,
    currency,
    codeHash,
    claimExpiresAt,
    expiryDays,
    note,
    idempotencyKey: `credits-gift:${authRes.user.id}:${requestId}`,
  });

  // THE BANK WANTS A STEP (MESITA-1670 pattern) — identical to buy. No gift
  // row exists yet; the webhook backstop finishes the job from the intent's
  // own metadata (codeHash included) once the guest completes the challenge.
  if (!outcome.ok && outcome.code === "requires_action") {
    const publishableKey = stripePublishableKey();
    if (!publishableKey) {
      console.error(
        "credits-gift 3DS: no STRIPE_PUBLISHABLE_KEY for the active mode; " +
          `intent ${outcome.action.paymentIntentId} left unconfirmed`,
      );
      return json(
        {
          ok: false,
          code: "requires_action",
          error:
            "Your bank needs extra verification for this card — try again shortly.",
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

  // "The confirm reader" — the charge just succeeded synchronously, using
  // the SAME codeHash already pinned on the intent's metadata above, so this
  // call and the webhook backstop can only ever converge on the same gift.
  const created = await admin.rpc("create_credit_gift", {
    p_organization_id: chargeable.organizationId,
    p_sender_id: authRes.user.id,
    p_paid_cents: paidCents,
    p_bonus_cents: bonusCents,
    p_currency: currency,
    p_code_hash: codeHash,
    p_claim_expires_at: claimExpiresAt,
    p_expiry_days: expiryDays,
    p_note: note,
    p_stripe_payment_intent_id: outcome.paymentIntentId,
  });
  if (created.error) {
    // The charge succeeded — never tell the guest it failed. The webhook
    // backstop will still write this SAME gift from the intent's own
    // metadata; this response only says a human should look if it doesn't
    // appear.
    return json(
      {
        ok: false,
        code: "charged_pending_gift",
        error:
          `Payment succeeded but recording the gift failed: ${created.error.message}. It will finish automatically — refresh shortly.`,
      },
      500,
    );
  }
  const result = created.data as
    | { ok: true; giftId: string }
    | { ok: false; code?: string }
    | null;
  if (!result?.ok) {
    // The pre-charge draw checked for a live collision and still lost the
    // race (or the RPC refused for some other reason) — the charge is
    // already pinned to THIS codeHash in Stripe metadata, so there is no
    // safe fresh code to retry with here. Astronomically rare at 10 digits;
    // flagged loudly rather than silently mis-reported as success.
    return json(
      {
        ok: false,
        code: "charged_pending_gift",
        error:
          "Payment succeeded but the gift code could not be recorded — this needs a human to look. Refresh shortly; do not retry the charge.",
      },
      500,
    );
  }

  return json({
    ok: true,
    state: "purchased",
    giftId: result.giftId,
    code,
    expiresAt: claimExpiresAt,
    expiryDays,
    bonusCents,
  });
});

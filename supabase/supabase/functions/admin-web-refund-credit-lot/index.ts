// Supabase Edge Function — admin-web-refund-credit-lot (admin console)
//
// The refund/cancel/adjust primitive support needs on a money feature
// (MESITA-1679): "a guest disputes a top-up. An org closes. Support must
// issue or claw back. Without this the first exception is a database
// console session against live money."
//
// TWO KINDS, and they never cross:
//   kind="refund" — real money is coming back via Stripe. This EF ONLY
//     calls stripe.refunds.create on the organization's connected account —
//     it never writes credit_ledger itself. The resulting charge.refunded
//     webhook (stripe-webhook-handle-event/credit-refund.ts) is the ONLY
//     writer of a 'refund' ledger row, so the ledger can never claim money
//     returned before Stripe has actually agreed. The response here is
//     PENDING: the balance updates asynchronously once the webhook lands.
//   kind="adjust" — a claw-back with no Stripe leg (an org closes, a bonus
//     was granted in error). This EF calls reverse_credit_lot directly —
//     either against ONE lot, or, when lotId is omitted in favor of
//     organizationId + consumerId, against every one of that guest's live
//     lots at that organization in one sweep (the "org closes" case). Each
//     lot's claw-back is its own atomic RPC call; the sweep as a whole is
//     NOT cross-lot atomic (see the loop below for why that's an accepted
//     trade-off for a rare, retryable, idempotent-per-lot admin action).
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import {
  corsPreflight,
  json,
  jsonError,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import { stripeSecretKey } from "../_shared/stripe-env.ts";

type Body = {
  lotId?: string;
  organizationId?: string;
  consumerId?: string;
  kind?: "refund" | "adjust";
  amountCents?: number | null;
  reason?: string;
};

type LotRow = {
  id: string;
  organization_id: string;
  stripe_payment_intent_id: string | null;
  paid_cents: number;
  bonus_cents: number;
  spent_cents: number;
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

  const kind = body.kind;
  if (kind !== "refund" && kind !== "adjust") {
    return jsonError("kind must be 'refund' or 'adjust'", 400);
  }
  const reason = (body.reason ?? "").trim();
  if (reason.length < 3) {
    return jsonError("reason is required (min 3 characters) — this is money, write it down", 400);
  }
  const amountCents = body.amountCents == null ? null : Number(body.amountCents);
  if (amountCents !== null && (!Number.isFinite(amountCents) || amountCents <= 0)) {
    return jsonError("amountCents must be a positive number or omitted (full amount)", 400);
  }

  const actor = authRes.user.emailLower ?? authRes.user.id;
  const reference = `admin:${actor}: ${reason}`;

  // ── kind=refund: real money, Stripe only, never the DB ──────────────────
  if (kind === "refund") {
    if (!body.lotId) return jsonError("lotId is required for a refund", 400);

    const lotRes = await admin
      .from("credit_lots")
      .select("id, organization_id, stripe_payment_intent_id, paid_cents, bonus_cents, spent_cents")
      .eq("id", body.lotId)
      .maybeSingle();
    if (lotRes.error) return jsonError(`lot_read: ${lotRes.error.message}`, 500);
    const lot = lotRes.data as LotRow | null;
    if (!lot) return jsonError("Lot not found", 404);
    if (!lot.stripe_payment_intent_id) {
      return jsonError("This lot carries no Stripe payment intent — nothing to refund via Stripe. Use kind=adjust instead.", 400);
    }

    const orgAccountRes = await admin
      .from("organization_payment_accounts")
      .select("stripe_account_id")
      .eq("organization_id", lot.organization_id)
      .maybeSingle();
    if (orgAccountRes.error) {
      return jsonError(`org_account_read: ${orgAccountRes.error.message}`, 500);
    }
    const connectedAccountId =
      (orgAccountRes.data as { stripe_account_id?: string } | null)?.stripe_account_id ?? null;
    if (!connectedAccountId) {
      return jsonError("This lot's organization has no connected Stripe account on file", 400);
    }

    const stripeKey = stripeSecretKey();
    if (!stripeKey) return jsonError("Stripe not configured", 500);
    const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: lot.stripe_payment_intent_id,
          ...(amountCents !== null ? { amount: amountCents } : {}),
          reason: "requested_by_customer",
          metadata: { credit_lot_id: lot.id, admin_actor: actor, reason },
        },
        {
          stripeAccount: connectedAccountId,
          // Same identifying-facts shape as connectAccountIdempotencyKey
          // (_shared/stripe-connect.ts): a retried click with the SAME lot
          // and amount is the same logical refund and must not double-fire
          // against Stripe; a different amount is a genuinely new refund.
          idempotencyKey: `credit-refund:${lot.id}:${amountCents ?? "full"}`,
        },
      );
      return json({
        ok: true,
        kind: "refund",
        stripeRefundId: refund.id,
        pending: true,
        message:
          "Stripe accepted the refund. The Credits balance updates once charge.refunded arrives (usually seconds) — it is NOT reflected yet.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe refund failed";
      return jsonError(`stripe_refund: ${message}`, 502);
    }
  }

  // ── kind=adjust: no Stripe leg, straight to the ledger ───────────────────
  if (body.lotId) {
    const { data, error } = await admin.rpc("reverse_credit_lot", {
      p_lot_id: body.lotId,
      p_kind: "adjust",
      p_amount_cents: amountCents,
      p_reference: reference,
    });
    if (error) return jsonError(`adjust: ${error.message}`, 500);
    const result = data as { ok: boolean; code?: string } | Record<string, unknown>;
    if (result.ok === false) {
      return json({ ok: false, ...result }, 409);
    }
    return json({ ok: true, kind: "adjust", ...result });
  }

  // Sweep mode: every live lot a consumer holds at one organization — the
  // "org closes" case. Not cross-lot atomic: each reverse_credit_lot call is
  // its own transaction, and a failure partway leaves the remainder for a
  // retry (safe, because every call is idempotent on its own reference).
  // Cross-lot atomicity is what spend_credits needs because a GUEST is
  // waiting on one consistent answer; here an OPERATOR is running a rare,
  // supervised action and can simply run it again.
  if (body.organizationId && body.consumerId) {
    const lotsRes = await admin
      .from("credit_lots")
      .select("id, paid_cents, bonus_cents, spent_cents")
      .eq("organization_id", body.organizationId)
      .eq("consumer_id", body.consumerId);
    if (lotsRes.error) return jsonError(`lots_read: ${lotsRes.error.message}`, 500);
    const lots = (lotsRes.data as Pick<LotRow, "id" | "paid_cents" | "bonus_cents" | "spent_cents">[]) ?? [];
    const live = lots.filter((l) => l.paid_cents + l.bonus_cents > l.spent_cents);

    const swept: unknown[] = [];
    for (const lot of live) {
      const { data, error } = await admin.rpc("reverse_credit_lot", {
        p_lot_id: lot.id,
        p_kind: "adjust",
        p_amount_cents: null,
        p_reference: reference,
      });
      if (error) {
        return json({ ok: false, error: `adjust_sweep: ${error.message}`, swept }, 500);
      }
      swept.push(data);
    }
    return json({ ok: true, kind: "adjust", sweptLotCount: live.length, swept });
  }

  return jsonError(
    "adjust needs either lotId, or organizationId + consumerId to sweep every live lot",
    400,
  );
});

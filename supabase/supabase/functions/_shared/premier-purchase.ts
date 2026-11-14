// Premier Refill purchase (MESITA-3168): a guest buys a pack of Refill days
// for any place, no owner check. One Stripe Checkout `payment` per pack
// (card only, USD), on Mesita's own account (test until Pato flips
// STRIPE_MODE and STRIPE_ALLOW_LIVE). Nothing is granted when the Checkout
// opens: once Stripe says paid, premier_refill_settle writes the days through
// premier_add_days (source purchase, request_id purchase:<id>), so a settle
// run twice adds them once. A refusal at settle (the place changed while the
// guest paid) is refunded in TEST; in live, or when the refund fails, the
// purchase waits as refund_needed for Pato to refund in Stripe (I-7).
//
// No webhook: consumer-web-get-premier-refill settles on Checkout's return
// and supabase-cron-sync-premier sweeps what nobody came back for.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { CHECKOUT_TTL_SEC, PREMIER_CURRENCY } from "./boost.ts";
import { readCheckoutSession } from "./checkout-session.ts";
import { isUuid } from "./place-id.ts";
import { isAllowedReturnUrl, type StripeCall } from "./stripe.ts";

export type RefillTier = 1 | 2;

/** One pack per tier: one year (Pato, MESITA-3386: "Upgrade plan must be one
 *  year. $100 USD. $1000 USD. Not three months"; 90 days at $30 / $300 from
 *  MESITA-3203 until then). The yearly-only Subscription is $99 / $999
 *  (MESITA-3285, boost.ts), so a pack never undercuts subscribing.
 *  A purchase keeps the days it stored when it opened. A price change is a
 *  PR. The 366-day queue cap in premier_refill_check means one pack at a
 *  time per place. */
export const REFILL_PACK_DAYS = 365;
export const REFILL_PACK_CENTS: Record<RefillTier, number> = { 1: 100_00, 2: 1000_00 };

/** The plan guests read (MESITA-3916, "Premier 2X/5X" until then): tier 1 is
 *  Mesita Pro, tier 2 Mesita Max. */
export const refillLabel = (tier: number): string => (tier === 2 ? "Mesita Max" : "Mesita Pro");
/** What the plan gives, in the guest's words (MESITA-3906). */
export const refillPerk = (tier: number): string => (tier === 2 ? "Max visibility boost" : "High visibility boost");

export type RefillStart = { placeId: string; tier: RefillTier; returnUrl: string };

export function parseRefillStart(body: Record<string, unknown>): { ok: true; start: RefillStart } | { ok: false; code: string; error: string } {
  const placeId = body.place_id;
  if (!isUuid(placeId)) return { ok: false, code: "place_invalid", error: "place_id must be a Mesita place id" };
  const tier = Number(body.tier);
  if (tier !== 1 && tier !== 2) return { ok: false, code: "tier_invalid", error: "tier must be 1 (2X) or 2 (5X)" };
  const returnUrl = body.return_url;
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return { ok: false, code: "return_url_invalid", error: "return_url is not a Mesita address" };
  }
  return { ok: true, start: { placeId, tier, returnUrl } };
}

// ── The check before a sale (premier_refill_check) ─────────────────────────

export type RefillCheck = {
  result: "ok" | "refused";
  code?: string;
  level: number;
  name: string | null;
  already: boolean;
  until: string;
};

export async function checkRefill(admin: SupabaseClient, placeId: string, tier: RefillTier): Promise<RefillCheck> {
  const { data, error } = await admin.rpc("premier_refill_check", {
    p_place_id: placeId,
    p_tier: tier,
    p_days: REFILL_PACK_DAYS,
  });
  if (error) throw new Error(`refill_check: ${error.message}`);
  return data as RefillCheck;
}

/** "Dec 3", in UTC. */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** What Checkout first shows when the place already runs at or above the
 *  pack's tier: buying keeps it there longer, it does not lift it. */
export function refillNotice(check: RefillCheck, tier: RefillTier): string | undefined {
  if (check.result !== "ok" || !check.already) return undefined;
  return `This place already has ${refillLabel(check.level)}; your Upgrade keeps ${refillLabel(tier)} until ${shortDay(check.until)}`;
}

/** What a refusal means, in the guest's words. */
export const REFILL_REFUSED: Record<string, string> = {
  not_found: "This place isn't on Mesita yet.",
  archived: "This place is closed on Mesita.",
  unlisted: "This place is hidden on Mesita right now.",
  paid_higher: "This place's own plan is already higher.",
  cap_reached: "This place has a year of Upgrades queued already.",
  stripe_unavailable: "Payments are not available right now.",
};

export function refillCheckoutParams(args: {
  customer: string;
  purchaseId: string;
  placeId: string;
  consumerId: string;
  tier: RefillTier;
  placeName: string;
  returnUrl: string;
  nowSec: number;
}): Record<string, unknown> {
  const sep = args.returnUrl.includes("?") ? "&" : "?";
  const metadata = {
    mesita_kind: "premier_refill",
    purchase_id: args.purchaseId,
    place_id: args.placeId,
    consumer_id: args.consumerId,
    tier: String(args.tier),
    days: String(REFILL_PACK_DAYS),
  };
  return {
    mode: "payment",
    payment_method_types: ["card"],
    customer: args.customer,
    client_reference_id: args.purchaseId,
    success_url: `${args.returnUrl}${sep}refill={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + CHECKOUT_TTL_SEC,
    metadata,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: PREMIER_CURRENCY,
        unit_amount: REFILL_PACK_CENTS[args.tier],
        product_data: { name: `Upgrade · ${refillLabel(args.tier)} · ${refillPerk(args.tier)} · one year · ${args.placeName}`.slice(0, 250) },
      },
    }],
    payment_intent_data: { metadata },
  };
}

// ── Settling ───────────────────────────────────────────────────────────────

export type PurchaseStatus = "open" | "expired" | "paid" | "granted" | "refunded" | "refund_needed";

export type RefillPurchase = {
  id: string;
  place_id: string;
  tier: number;
  amount_cents: number;
  currency: string;
  livemode: boolean;
  status: PurchaseStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  refusal_code: string | null;
  ends_at: string | null;
  created_at: string;
};

export const PURCHASE_COLUMNS =
  "id, place_id, tier, amount_cents, currency, livemode, status, stripe_checkout_session_id, stripe_payment_intent_id, refusal_code, ends_at, created_at";

/** One line per status, for the guest. */
export function purchaseLine(p: { status: PurchaseStatus; tier: number; ends_at: string | null }): string {
  switch (p.status) {
    case "open":
      return "Waiting for payment";
    case "expired":
      return "Checkout expired, nothing charged";
    case "paid":
      return "Paid — the Upgrade is being added";
    case "granted":
      return p.ends_at ? `Added: ${refillLabel(p.tier)} until ${shortDay(p.ends_at)}` : `Added: ${refillLabel(p.tier)}`;
    case "refunded":
      return "Refunded";
    case "refund_needed":
      return "Paid — we will refund you";
  }
}

export const refundKey = (purchaseId: string) => `refill-refund-${purchaseId}`;

/** Settles one open or paid purchase against Stripe and answers its status
 *  after. Idempotent: each status moves only from the one before it
 *  (conditional updates), the days are written once (replay key), and a
 *  refund carries one Idempotency-Key per purchase. */
export async function settleRefillPurchase(
  admin: SupabaseClient,
  stripe: StripeCall,
  purchase: RefillPurchase,
  nowMs: number,
): Promise<PurchaseStatus> {
  if (purchase.status !== "open" && purchase.status !== "paid") return purchase.status;
  let paymentIntent = purchase.stripe_payment_intent_id;

  if (purchase.status === "open") {
    const sessionId = purchase.stripe_checkout_session_id;
    if (!sessionId) {
      // No session was ever stored: nothing can be paid. Past the Checkout
      // window it is closed so it stops being read.
      if (nowMs - Date.parse(purchase.created_at) > CHECKOUT_TTL_SEC * 1000) {
        return await expire(admin, purchase.id) ? "expired" : "open";
      }
      return "open";
    }
    const verdict = await readCheckoutSession(stripe, sessionId, purchase.id, {
      amountCents: purchase.amount_cents,
      currency: purchase.currency,
      livemode: purchase.livemode,
    });
    if (verdict.kind === "mismatch") {
      console.error("[premier-refill] session_mismatch", JSON.stringify({ purchase_id: purchase.id, session_id: sessionId }));
      return "open";
    }
    if (verdict.kind === "pending") return "open";
    if (verdict.kind === "expired") return await expire(admin, purchase.id) ? "expired" : "open";
    paymentIntent = verdict.paymentIntent;
  }

  const { data, error } = await admin.rpc("premier_refill_settle", {
    p_purchase_id: purchase.id,
    p_payment_intent: paymentIntent,
  });
  if (error) throw new Error(`refill_settle: ${error.message}`);
  const res = (data ?? {}) as { outcome?: string; code?: string };
  console.log(JSON.stringify({ purchase_id: purchase.id, place: purchase.place_id, tier: purchase.tier, outcome: res.outcome, code: res.code ?? null }));
  if (res.outcome === "granted") return "granted";
  if (res.outcome !== "refused") return (res.outcome as PurchaseStatus) ?? "paid";

  // Refused at settle: the guest paid for days the place can't take.
  if (purchase.livemode || !paymentIntent) {
    return await moveFromPaid(admin, purchase.id, "refund_needed");
  }
  try {
    await stripe(
      "POST",
      "refunds",
      { payment_intent: paymentIntent, metadata: { mesita_kind: "premier_refill", purchase_id: purchase.id } },
      { idempotencyKey: refundKey(purchase.id) },
    );
  } catch (err) {
    console.error("[premier-refill] refund_failed", JSON.stringify({ purchase_id: purchase.id, error: String(err) }));
    return await moveFromPaid(admin, purchase.id, "refund_needed");
  }
  return await moveFromPaid(admin, purchase.id, "refunded");
}

async function expire(admin: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await admin
    .from("premier_refill_purchases")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open")
    .select("id");
  if (error) throw new Error(`refill_expire: ${error.message}`);
  return (data ?? []).length > 0;
}

/** paid → `to`, only from paid; answers the status the row holds after. */
async function moveFromPaid(admin: SupabaseClient, id: string, to: "refunded" | "refund_needed"): Promise<PurchaseStatus> {
  const { data, error } = await admin
    .from("premier_refill_purchases")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "paid")
    .select("status");
  if (error) throw new Error(`refill_${to}: ${error.message}`);
  if ((data ?? []).length > 0) return to;
  const { data: now, error: readErr } = await admin
    .from("premier_refill_purchases")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(`refill_read: ${readErr.message}`);
  return ((now as { status?: PurchaseStatus } | null)?.status) ?? to;
}

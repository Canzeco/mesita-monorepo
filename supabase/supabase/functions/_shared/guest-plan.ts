// The guest Plan, sold (MESITA-3870). Pato, 2026-11-14: "2 Reservations per
// month is Free. 10 Reservations per month if Pro. thats it. and make it 2
// dollar per month."
//
// Pro is a monthly Stripe subscription on Mesita's own account, in Premier's
// universe (STRIPE_MODE via boostStripeKey; test until Pato flips it), on the
// guest's premier_customers customer. There is no webhook (the EF name is the
// ACL): the subscription is read back from Stripe
//   · on Checkout's return (consumer-web-get-plan with session_id),
//   · on every open of Me › Plan (consumer-web-get-plan),
//   · when a reservation finds the paid period over
//     (consumer-web-create-reservation),
// and that read is written to consumers.plan + plan_* columns. A renewal
// therefore lands the first time any of those runs after Stripe charges.
//
// consumers.plan = 'premium' with no subscription is an operator's grant
// (Manage › Guests): it never lapses here.

import { UNCOUNTED_STATES_FILTER } from "./reservation-cap.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./stripe.ts";

/** Pro's price: $3.00 a month (MESITA-5022, Pato: "make the consumer
 *  subscription 3 dollars a month"; $1.00 under MESITA-3881, $2.00 under
 *  MESITA-3870). Existing subscribers keep what Stripe already bills them. web-consumer's plan-perks.ts prints the same
 *  number; reservation-cap.test.ts pins the two together. */
export const PRO_PRICE_CENTS = 300;
export const PRO_CURRENCY = "usd";

/** The consumers columns this module reads. */
export const PLAN_COLUMNS =
  "plan, reservation_cap_override, plan_stripe_subscription, plan_livemode, plan_paid_until, plan_cancel_at_period_end";

export type PlanRow = {
  plan?: unknown;
  reservation_cap_override?: unknown;
  plan_stripe_subscription?: unknown;
  plan_livemode?: unknown;
  plan_paid_until?: unknown;
  plan_cancel_at_period_end?: unknown;
};

/** True when a stored subscription still pays for Pro at `now`. */
export function paidThrough(row: PlanRow | null | undefined, now: number, livemode: boolean): boolean {
  if (!row || typeof row.plan_stripe_subscription !== "string" || row.plan_stripe_subscription === "") return false;
  if (row.plan_livemode !== livemode) return false;
  const until = typeof row.plan_paid_until === "string" ? Date.parse(row.plan_paid_until) : NaN;
  return Number.isFinite(until) && until > now;
}

/** The plan that applies at `now`: 'premium' when an operator granted it (no
 *  subscription) or a subscription of this universe has paid past `now`;
 *  otherwise 'free'. */
export function effectivePlan(row: PlanRow | null | undefined, now: number, livemode: boolean): "free" | "premium" {
  if (!row || row.plan !== "premium") return "free";
  const sub = row.plan_stripe_subscription;
  if (typeof sub !== "string" || sub === "") return "premium";
  return paidThrough(row, now, livemode) ? "premium" : "free";
}

/** True when the row says Pro by subscription but the paid period is over (or
 *  in another universe): worth one read from Stripe before refusing. */
export function needsRefresh(row: PlanRow | null | undefined, now: number, livemode: boolean): boolean {
  if (!row || row.plan !== "premium") return false;
  const sub = row.plan_stripe_subscription;
  return typeof sub === "string" && sub !== "" && row.plan_livemode === livemode && !paidThrough(row, now, livemode);
}

/** What a Stripe subscription object means for the plan. */
export type SubscriptionRead = {
  /** Pro is paid now. */
  active: boolean;
  /** The end of the paid period (ISO), or null. */
  paidUntil: string | null;
  cancelAtPeriodEnd: boolean;
  /** The subscription is over for good; forget it. */
  ended: boolean;
};

const ACTIVE = new Set(["active", "trialing"]);
const ENDED = new Set(["canceled", "incomplete_expired", "unpaid"]);

/** Reads a subscription object. The period end lives on the subscription in
 *  older API versions and on its first item in newer ones; both are read. */
export function readSubscription(sub: Record<string, unknown>, now: number): SubscriptionRead {
  const status = String(sub.status ?? "");
  const items = (sub.items as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
  const endSec = typeof sub.current_period_end === "number"
    ? sub.current_period_end
    : typeof items[0]?.current_period_end === "number"
    ? items[0].current_period_end as number
    : null;
  const paidUntil = endSec ? new Date(endSec * 1000).toISOString() : null;
  const active = ACTIVE.has(status) && endSec !== null && endSec * 1000 > now;
  return {
    active,
    paidUntil,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    ended: ENDED.has(status),
  };
}

/** The consumers patch a subscription read writes. */
export function planPatch(
  subscriptionId: string,
  livemode: boolean,
  read: SubscriptionRead,
): Record<string, unknown> {
  if (read.ended) {
    return {
      plan: "free",
      plan_stripe_subscription: null,
      plan_livemode: null,
      plan_paid_until: null,
      plan_cancel_at_period_end: false,
    };
  }
  return {
    plan: read.active ? "premium" : "free",
    plan_stripe_subscription: subscriptionId,
    plan_livemode: livemode,
    plan_paid_until: read.paidUntil,
    plan_cancel_at_period_end: read.cancelAtPeriodEnd,
  };
}

/** Reads the subscription from Stripe and writes what it says. Returns the
 *  fresh row's plan fields. Throws on a Stripe or database failure. */
export async function syncPlan(
  admin: SupabaseClient,
  stripe: StripeCall,
  consumerId: string,
  subscriptionId: string,
  livemode: boolean,
): Promise<PlanRow> {
  const sub = await stripe("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
  const patch = planPatch(subscriptionId, livemode, readSubscription(sub, Date.now()));
  // Plan is outside the consumer door (consumer-doc.ts); this RPC is its one
  // Stripe writer (migration 20261114130000).
  const { data, error } = await admin.rpc("consumer_plan_sync", {
    p_consumer: consumerId,
    p_plan: patch.plan,
    p_subscription: patch.plan_stripe_subscription,
    p_livemode: patch.plan_livemode,
    p_paid_until: patch.plan_paid_until,
    p_cancel_at_period_end: patch.plan_cancel_at_period_end,
  });
  if (error) throw new Error(`plan_write: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("plan_write: no consumer row");
  return row as PlanRow;
}

/** Checkout's return: the session must be this guest's Pro Checkout, complete,
 *  with a subscription. Returns the subscription id, or null. */
export function subscriptionOfSession(session: Record<string, unknown>, consumerId: string): string | null {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  if (session.mode !== "subscription") return null;
  if (session.client_reference_id !== consumerId || meta.mesita_kind !== "guest_plan") return null;
  if (session.status !== "complete") return null;
  const sub = session.subscription;
  if (typeof sub === "string" && sub !== "") return sub;
  if (sub && typeof sub === "object" && typeof (sub as { id?: unknown }).id === "string") {
    return (sub as { id: string }).id;
  }
  return null;
}

/** True for a Stripe object (Checkout session or subscription) that is this
 *  guest's Pro, by the metadata planCheckoutParams writes on both. The
 *  customer also pays Premier, so the customer alone never decides. */
function isGuestPlan(obj: Record<string, unknown>, consumerId: string): boolean {
  const meta = (obj.metadata ?? {}) as Record<string, unknown>;
  return meta.mesita_kind === "guest_plan" && meta.consumer_id === consumerId;
}

/** A read subscription may be written to the row only when it is the one on
 *  file, it pays now, or the row holds nothing it would undo: an old return
 *  link must never replace a paid Pro or an operator's grant. */
export function mayAdopt(row: PlanRow, subscriptionId: string, read: SubscriptionRead): boolean {
  if (row.plan_stripe_subscription === subscriptionId || read.active) return true;
  return !read.ended && !row.plan_stripe_subscription && row.plan !== "premium";
}

/** What Checkout's return means (MESITA-4915). `pending` only for the guest's
 *  own session while it can still be paid; `failed` is terminal, and the app
 *  forgets the id. `sub` is the session's subscription as Stripe has it now,
 *  null when the session has none. */
export function sessionOutcome(
  session: Record<string, unknown>,
  consumerId: string,
  sub: Record<string, unknown> | null,
  now: number,
): "paid" | "pending" | "failed" {
  if (session.mode !== "subscription" || session.client_reference_id !== consumerId) return "failed";
  if (!isGuestPlan(session, consumerId)) return "failed";
  if (session.status === "open") return "pending";
  if (session.status !== "complete") return "failed";
  if (!sub) return session.payment_status === "unpaid" ? "pending" : "failed";
  if (readSubscription(sub, now).active) return "paid";
  return sub.status === "incomplete" ? "pending" : "failed";
}

/** The guest's Pro subscription that is not over: a paying one first, then one
 *  whose invoice can still be paid; null when Checkout may open. */
export function blockingSubscription(
  subs: Array<Record<string, unknown>>,
  consumerId: string,
  now: number,
): { id: string; active: boolean; payUrl: string | null } | null {
  const live = subs.filter((s) => typeof s.id === "string" && isGuestPlan(s, consumerId) && !ENDED.has(String(s.status ?? "")));
  const pick = live.find((s) => readSubscription(s, now).active) ?? live[0];
  if (!pick) return null;
  const invoice = (pick.latest_invoice && typeof pick.latest_invoice === "object" ? pick.latest_invoice : {}) as Record<string, unknown>;
  return {
    id: pick.id as string,
    active: readSubscription(pick, now).active,
    payUrl: invoice.status === "open" && typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null,
  };
}

/** Before a new Checkout: closes the guest's other open Pro Checkouts, so two
 *  tabs cannot both pay, then reads the customer's subscriptions from Stripe.
 *  In that order: a Checkout paid in between shows up as a subscription.
 *  Throws when Stripe fails; nothing is sold then. */
export async function findBlockingSubscription(
  stripe: StripeCall,
  customer: string,
  consumerId: string,
): Promise<ReturnType<typeof blockingSubscription>> {
  const open = await stripe("GET", "checkout/sessions", { customer, status: "open", limit: 100 });
  for (const s of (open.data ?? []) as Array<Record<string, unknown>>) {
    if (typeof s.id !== "string" || !isGuestPlan(s, consumerId)) continue;
    await stripe("POST", `checkout/sessions/${encodeURIComponent(s.id)}/expire`);
  }
  const subs = await stripe("GET", "subscriptions", {
    customer,
    status: "all",
    limit: 100,
    expand: ["data.latest_invoice"],
  });
  return blockingSubscription((subs.data ?? []) as Array<Record<string, unknown>>, consumerId, Date.now());
}

/** Checkout lives 30 minutes: a stale tab cannot pay later. */
const CHECKOUT_TTL_SEC = 30 * 60;

/** The Pro Checkout: a $2/month subscription, card only. Returns to
 *  `returnUrl` with `plan={CHECKOUT_SESSION_ID}`. */
export function planCheckoutParams(args: {
  customer: string;
  consumerId: string;
  returnUrl: string;
  nowSec: number;
}): Record<string, unknown> {
  const sep = args.returnUrl.includes("?") ? "&" : "?";
  const metadata = { mesita_kind: "guest_plan", consumer_id: args.consumerId, plan: "premium" };
  return {
    mode: "subscription",
    payment_method_types: ["card"],
    customer: args.customer,
    client_reference_id: args.consumerId,
    success_url: `${args.returnUrl}${sep}plan={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + CHECKOUT_TTL_SEC,
    metadata,
    subscription_data: { metadata },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: PRO_CURRENCY,
        unit_amount: PRO_PRICE_CENTS,
        recurring: { interval: "month" },
        product_data: { name: "Mesita Pro" },
      },
    }],
  };
}

/** Reservations that count against this month's cap: the guest's month is
 *  Mexico City's (MESITA-3626); cancelled and test tickets do not count. */
export async function reservationsThisMonth(
  admin: SupabaseClient,
  consumerId: string,
  monthStartIso: string,
): Promise<number> {
  const { count, error } = await admin
    .from("reservation_tickets")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("is_test", false)
    .gte("created_at", monthStartIso)
    .not("state", "in", UNCOUNTED_STATES_FILTER);
  if (error) throw new Error(`reservations_count: ${error.message}`);
  return count ?? 0;
}

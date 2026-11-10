// Premier's writes (MESITA-2925): the guest's Stripe customer, Checkout
// confirm and capture, the renewal charge, and ending pledges. Every period
// write is a `premier_*` RPC under the place lock; a pledge becomes the
// place's subscription only through premier_make_payer. The rules, prices
// and reads are boost.ts; boost-writes.test.ts pins these paths with Stripe
// and the database stubbed.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { errorMessage } from "./errors.ts";
import { type StripeCall, StripeError } from "./stripe.ts";
import {
  type BoostInterval,
  type BoostTier,
  captureKey,
  chargeKey,
  chargeOutcome,
  type ChargeOutcome,
  CHARGING_GIVE_UP_MS,
  customerKey,
  type EndedReason,
  type Period,
  PERIOD_COLUMNS,
  type Pledge,
  PLEDGE_COLUMNS,
  PREMIER_LABEL,
  type Quote,
  readCustomer,
  readPeriod,
  readPledge,
  renewalChargeParams,
  staleChargeAction,
  TIER_BY_RANK,
  type TierRank,
} from "./boost.ts";

/** The guest's Stripe customer for this mode, created once. Two tabs at once
 *  share one customer: Stripe's idempotency key returns the same one and the
 *  row is written only if none exists. */
export async function ensureCustomer(
  admin: SupabaseClient,
  stripe: StripeCall,
  consumerId: string,
  email: string | null,
  livemode: boolean,
): Promise<string> {
  const existing = await readCustomer(admin, consumerId, livemode);
  if (existing) return existing;
  const created = await stripe(
    "POST",
    "customers",
    { ...(email ? { email } : {}), metadata: { mesita_consumer_id: consumerId } },
    { idempotencyKey: customerKey(consumerId, livemode) },
  );
  const id = idOf(created);
  if (!id) throw new Error("customer_create: no id");
  const { error } = await admin
    .from("premier_customers")
    .upsert({ consumer_id: consumerId, livemode, stripe_customer: id }, {
      onConflict: "consumer_id,livemode",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(`customer_write: ${error.message}`);
  return (await readCustomer(admin, consumerId, livemode)) ?? id;
}

async function updatePledge(
  admin: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  try {
    const { error } = await admin
      .from("place_backings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    return error ? error.message : null;
  } catch (err) {
    return errorMessage(err);
  }
}

/** A saved card Mesita will never charge again is detached. A card that is
 *  already gone (or was never attached) is fine; anything else is logged and
 *  left, since the pledge holding it has ended and nothing charges it. */
export async function detachCard(stripe: StripeCall | null, paymentMethod: string | null | undefined): Promise<void> {
  if (!stripe || !paymentMethod) return;
  try {
    await stripe("POST", `payment_methods/${encodeURIComponent(paymentMethod)}/detach`);
  } catch (err) {
    if (err instanceof StripeError && (err.code === "resource_missing" || err.httpStatus === 400)) return;
    console.error("[premier] detach_failed", JSON.stringify({ payment_method: paymentMethod, error: errorMessage(err) }));
  }
}

const CLEAR_CHECKOUT = {
  checkout_kind: null,
  pending_tier: null,
  pending_interval: null,
  pending_amount_cents: null,
  quoted_period_id: null,
  quoted_credit_cents: 0,
} as const;

/** End a pledge (with its reason) and detach its card. */
async function endPledge(
  admin: SupabaseClient,
  stripe: StripeCall | null,
  pledge: Pledge,
  reason: EndedReason,
  paymentMethod: string | null = pledge.stripe_payment_method_id,
): Promise<void> {
  const err = await updatePledge(admin, pledge.id, {
    ...CLEAR_CHECKOUT,
    status: "ended",
    ended_reason: reason,
    ended_at: new Date().toISOString(),
  });
  if (err) throw new Error(`pledge_end: ${err}`);
  await detachCard(stripe, paymentMethod);
  if (paymentMethod !== pledge.stripe_payment_method_id) await detachCard(stripe, pledge.stripe_payment_method_id);
}

/** The payer's Checkout is settled without changing their subscription (a
 *  change that lost or was declined): its terms stay, a card it saved that is
 *  not the subscription's is detached. */
async function dropChange(admin: SupabaseClient, stripe: StripeCall, pledge: Pledge, paymentMethod: string | null): Promise<void> {
  const err = await updatePledge(admin, pledge.id, CLEAR_CHECKOUT);
  if (err) throw new Error(`pledge_drop_change: ${err}`);
  if (paymentMethod && paymentMethod !== pledge.stripe_payment_method_id) await detachCard(stripe, paymentMethod);
}

/** The payer's change took: pending terms move in, and the card the
 *  Checkout saved becomes the subscription's (the old one is detached). */
async function applyChange(admin: SupabaseClient, stripe: StripeCall, pledge: Pledge, paymentMethod: string | null): Promise<void> {
  const patch: Record<string, unknown> = { ...CLEAR_CHECKOUT };
  if (pledge.pending_tier) {
    patch.tier = pledge.pending_tier;
    patch.billing_interval = pledge.pending_interval ?? pledge.billing_interval;
    patch.amount_cents = pledge.pending_amount_cents ?? pledge.amount_cents;
  }
  if (paymentMethod) patch.stripe_payment_method_id = paymentMethod;
  const err = await updatePledge(admin, pledge.id, patch);
  if (err) throw new Error(`pledge_change: ${err}`);
  if (paymentMethod && pledge.stripe_payment_method_id && paymentMethod !== pledge.stripe_payment_method_id) {
    await detachCard(stripe, pledge.stripe_payment_method_id);
  }
}

/** The one path to `ready` (premier_make_payer): this pledge becomes the
 *  place's subscription; any other ready pledge there ended `taken_over` and
 *  its card is detached. `charging`: another charge is in flight, ask again.
 *  `covered`: an early start outside the last 7 days of the Refill days. */
async function makePayer(
  admin: SupabaseClient,
  stripe: StripeCall,
  pledge: Pledge,
  paymentMethod: string | null,
): Promise<"ready" | "charging" | "covered" | "ended"> {
  const { data, error } = await admin.rpc("premier_make_payer", {
    p_backing_id: pledge.id,
    p_payment_method: paymentMethod,
  });
  if (error) throw new Error(`premier_make_payer: ${error.message}`);
  const r = (data ?? {}) as { result?: string; detach?: string[] };
  if (r.result === "ready") {
    for (const pm of r.detach ?? []) await detachCard(stripe, pm);
    const err = await updatePledge(admin, pledge.id, CLEAR_CHECKOUT);
    if (err) throw new Error(`pledge_ready: ${err}`);
    return "ready";
  }
  if (r.result === "charging") return "charging";
  if (r.result === "covered") return "covered";
  return "ended";
}

type ClaimResult = { result: "started" | "settled" | "stale" | "missing"; period_id?: string; reason?: string };

async function claim(
  admin: SupabaseClient,
  pledge: Pledge,
  meta: Record<string, string>,
  args: { paymentIntentId: string | null; sessionId: string; status: "charging" | "paid"; livemode: boolean },
): Promise<ClaimResult> {
  const { data, error } = await admin.rpc("premier_claim", {
    p_backing_id: pledge.id,
    p_quoted_period_id: pledge.quoted_period_id,
    p_tier: meta.tier,
    p_interval: meta.interval,
    p_price_cents: Number(meta.price_cents) || 0,
    p_credit_cents: Number(meta.credit_cents) || 0,
    p_extra_days: Number(meta.extra_days) || 0,
    p_charged_cents: Number(meta.charge_cents) || 0,
    p_payment_intent_id: args.paymentIntentId,
    p_checkout_session_id: args.sessionId,
    p_status: args.status,
    p_livemode: args.livemode,
  });
  if (error) throw new Error(`premier_claim: ${error.message}`);
  return data as ClaimResult;
}

export type SettleResult = {
  status: string;
  /** Set when the decline ended the pledge (a renewal, or a first purchase). */
  ended_reason?: EndedReason | null;
  payment_method?: string | null;
};

async function settle(
  admin: SupabaseClient,
  stripe: StripeCall | null,
  periodId: string,
  outcome: "paid" | "declined",
  paymentIntentId: string | null,
): Promise<SettleResult> {
  const { data, error } = await admin.rpc("premier_settle", {
    p_period_id: periodId,
    p_outcome: outcome,
    p_payment_intent_id: paymentIntentId,
  });
  if (error) throw new Error(`premier_settle: ${error.message}`);
  const r = (data ?? { status: "missing" }) as SettleResult;
  if (r.ended_reason) {
    console.error("[premier] ended", JSON.stringify({ period_id: periodId, reason: r.ended_reason }));
    await detachCard(stripe, r.payment_method);
  }
  return r;
}

/** Capture a held payment for a period already claimed, then settle it. A
 *  capture Stripe refuses settles declined (the cut period gets its end back;
 *  a first purchase ends `checkout_failed`); an unknown answer leaves it
 *  charging for the cron. */
async function captureClaim(
  admin: SupabaseClient,
  stripe: StripeCall,
  periodId: string,
  pi: Record<string, unknown>,
): Promise<"paid" | "declined" | "unknown"> {
  const piId = idOf(pi)!;
  if (pi.status === "succeeded") {
    const r = await settle(admin, stripe, periodId, "paid", piId);
    return r.status === "declined" ? "declined" : "paid";
  }
  try {
    const captured = await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/capture`, undefined, {
      idempotencyKey: captureKey(piId),
    });
    if (captured.status === "succeeded") {
      await settle(admin, stripe, periodId, "paid", piId);
      return "paid";
    }
  } catch (err) {
    if (err instanceof StripeError && err.httpStatus >= 400 && err.httpStatus < 500) {
      console.error("[premier] capture_refused", JSON.stringify({ period_id: periodId, pi: piId, error: err.message }));
      await settle(admin, stripe, periodId, "declined", piId);
      return "declined";
    }
    console.error("[premier] capture_unknown", JSON.stringify({ period_id: periodId, pi: piId, error: errorMessage(err) }));
  }
  return "unknown";
}

/** What a Checkout came to, as the guest is told on return. */
export type ConfirmOutcome =
  | "confirmed" // the subscription runs (or the change took)
  | "saved" // a card was saved (resume, update card)
  | "lost" // another Checkout won the place first; the hold was released
  | "declined" // the card was declined; nothing was charged
  | "covered" // Mesita's Manual Premier already gives this level
  | "pending"
  | "expired"
  | "none";

/** A Checkout already settled, read back from the pledge (a second return,
 *  or a reload). */
function settledOutcome(pledge: Pledge): ConfirmOutcome {
  if (pledge.status === "ready") return "confirmed";
  if (pledge.status === "open") return "pending";
  switch (pledge.ended_reason) {
    case "lost":
      return "lost";
    case "checkout_failed":
      return "declined";
    case "left":
      return "expired";
    default:
      return "none";
  }
}

/** Checkout's return and the cron settle a pledge's Checkout here, and only
 *  here. Bound to the pledge's own stored session, whose metadata must name
 *  this pledge. Pays now: claim under the place lock, then capture, then the
 *  pledge becomes the subscription (premier_make_payer) or, for the payer,
 *  takes its new terms. A Checkout that loses releases its hold; a new
 *  pledge then ends (`lost`, card detached) and never becomes ready. Setup:
 *  a resume becomes the subscription, an update swaps the card, a change the
 *  credit covers is claimed. Idempotent. */
export async function confirmPledge(
  admin: SupabaseClient,
  stripe: StripeCall,
  pledge: Pledge,
  livemode: boolean,
): Promise<ConfirmOutcome> {
  const sessionId = pledge.stripe_checkout_session_id;
  if (!sessionId) return "none";
  if (!pledge.checkout_kind) return settledOutcome(pledge);
  const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`, {
    expand: ["payment_intent", "setup_intent"],
  });
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.backing_id !== pledge.id) {
    console.error("[premier] session_mismatch", JSON.stringify({ backing_id: pledge.id, session_id: sessionId }));
    return "none";
  }
  const kind = pledge.checkout_kind;
  const isNew = pledge.status === "open";
  if (session.status === "open") return "pending";
  if (session.status === "expired") {
    if (isNew) await endPledge(admin, stripe, pledge, "left", null);
    else await dropChange(admin, stripe, pledge, null);
    return "expired";
  }

  if (session.mode === "payment") {
    const pi = session.payment_intent as Record<string, unknown> | null;
    const piId = idOf(pi);
    if (!pi || !piId) return "pending";
    const pm = idOf(pi.payment_method);
    if (pi.status === "canceled") {
      if (isNew) await endPledge(admin, stripe, pledge, "lost", pm);
      else await dropChange(admin, stripe, pledge, pm);
      return "lost";
    }
    if (pi.status !== "requires_capture" && pi.status !== "succeeded") return "pending";
    const claimed = await claim(admin, pledge, meta, { paymentIntentId: piId, sessionId, status: "charging", livemode });
    if (claimed.result === "stale") {
      // A charge in flight may still fail: keep the hold and ask again.
      if (claimed.reason === "charging") return "pending";
      if (pi.status === "requires_capture") {
        await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/cancel`, undefined, {
          idempotencyKey: `premier-release:${piId}`,
        });
      } else {
        // Captured already and stale: cannot happen under the lock. Refund it.
        await stripe("POST", "refunds", { payment_intent: piId }, { idempotencyKey: `premier-refund:${piId}` });
        console.error("[premier] refund_after_capture", JSON.stringify({ backing_id: pledge.id, pi: piId }));
      }
      if (isNew) await endPledge(admin, stripe, pledge, "lost", pm);
      else await dropChange(admin, stripe, pledge, pm);
      return claimed.reason === "covered" ? "covered" : "lost";
    }
    if (claimed.result === "missing" || !claimed.period_id) return "none";
    const outcome = await captureClaim(admin, stripe, claimed.period_id, pi);
    if (outcome === "unknown") return "pending";
    if (outcome === "declined") {
      // A first purchase was ended by premier_settle (checkout_failed); the
      // payer's own change keeps the subscription as it was.
      if (isNew) await detachCard(stripe, pm);
      else await dropChange(admin, stripe, pledge, pm);
      return "declined";
    }
    if (isNew) {
      const r = await makePayer(admin, stripe, pledge, pm);
      return r === "ready" ? "confirmed" : r === "charging" ? "pending" : "none";
    }
    await applyChange(admin, stripe, pledge, pm);
    return "confirmed";
  }

  // Setup: the card is saved.
  const si = session.setup_intent as Record<string, unknown> | null;
  const pm = idOf(si?.payment_method);
  if (!pm) return "pending";
  if (kind === "update_card") {
    if (pledge.status !== "ready") {
      await detachCard(stripe, pm);
      return "none";
    }
    await applyChange(admin, stripe, pledge, pm);
    return "saved";
  }
  if (kind === "resume") {
    const r = await makePayer(admin, stripe, pledge, pm);
    if (r === "charging") return "pending";
    if (r === "covered") {
      await endPledge(admin, stripe, pledge, "covered", pm);
      return "covered";
    }
    if (r === "ended") {
      await detachCard(stripe, pm);
      return "none";
    }
    return "saved";
  }
  // A change the credit covers: claimed as paid, nothing charged.
  const claimed = await claim(admin, pledge, meta, { paymentIntentId: null, sessionId, status: "paid", livemode });
  if (claimed.result === "stale") {
    if (claimed.reason === "charging") return "pending";
    if (isNew) await endPledge(admin, stripe, pledge, "lost", pm);
    else await dropChange(admin, stripe, pledge, pm);
    return claimed.reason === "covered" ? "covered" : "lost";
  }
  if (claimed.result === "missing") return "none";
  if (isNew) {
    const r = await makePayer(admin, stripe, pledge, pm);
    return r === "ready" ? "confirmed" : r === "charging" ? "pending" : "none";
  }
  await applyChange(admin, stripe, pledge, pm);
  return "confirmed";
}

/** The payer's upgrade covered by credit on their saved card: no Checkout,
 *  claimed straight away. */
export async function claimWithoutCheckout(
  admin: SupabaseClient,
  pledge: Pledge,
  tier: BoostTier,
  interval: BoostInterval,
  q: Quote,
  quotedPeriodId: string | null,
  livemode: boolean,
): Promise<"confirmed" | "lost" | "covered"> {
  const { data, error } = await admin.rpc("premier_claim", {
    p_backing_id: pledge.id,
    p_quoted_period_id: quotedPeriodId,
    p_tier: tier,
    p_interval: interval,
    p_price_cents: q.price_cents,
    p_credit_cents: q.credit_cents,
    p_extra_days: q.extra_days,
    p_charged_cents: 0,
    p_payment_intent_id: null,
    p_checkout_session_id: null,
    p_status: "paid",
    p_livemode: livemode,
  });
  if (error) throw new Error(`premier_claim: ${error.message}`);
  const claimed = data as ClaimResult;
  if (claimed.result !== "started") return claimed.reason === "covered" ? "covered" : "lost";
  const err = await updatePledge(admin, pledge.id, {
    tier,
    billing_interval: interval,
    amount_cents: q.price_cents,
    quoted_period_id: null,
    quoted_credit_cents: 0,
  });
  if (err) throw new Error(`pledge_update: ${err}`);
  return "confirmed";
}

/** Settle a charge in flight. A held payment is captured; a renewal's is
 *  re-asked with the same key; past 24 h a payment Stripe still has not
 *  finished is cancelled and declined. */
export async function settleCharging(
  admin: SupabaseClient,
  stripe: StripeCall,
  period: Period,
  now = Date.now(),
): Promise<ChargeOutcome> {
  if (period.stripe_payment_intent_id) {
    let pi: Record<string, unknown>;
    try {
      pi = await stripe("GET", `payment_intents/${encodeURIComponent(period.stripe_payment_intent_id)}`);
    } catch (err) {
      console.error("[premier] settle_lookup", period.id, errorMessage(err));
      return "unknown";
    }
    if (pi.status === "requires_capture") {
      return await captureClaim(admin, stripe, period.id, pi);
    }
    const action = staleChargeAction(String(pi.status));
    if (action === "paid") {
      await settle(admin, stripe, period.id, "paid", period.stripe_payment_intent_id);
      return "paid";
    }
    if (action === "wait" && now - Date.parse(period.created_at) < CHARGING_GIVE_UP_MS) return "unknown";
    if (pi.status !== "canceled") {
      try {
        await stripe("POST", `payment_intents/${encodeURIComponent(period.stripe_payment_intent_id)}/cancel`);
      } catch (err) {
        console.error("[premier] settle_cancel", period.id, errorMessage(err));
        return "unknown";
      }
    }
    await settle(admin, stripe, period.id, "declined", period.stripe_payment_intent_id);
    return "declined";
  }
  return await attemptRenewalCharge(admin, stripe, period, now);
}

/** One renewal charge for a `charging` row the RPC opened. A decline ends
 *  the subscription (premier_settle) and detaches its card. */
export async function attemptRenewalCharge(
  admin: SupabaseClient,
  stripe: StripeCall,
  period: Period,
  now = Date.now(),
): Promise<ChargeOutcome> {
  const pledge = period.backing_id ? await readPledge(admin, period.backing_id) : null;
  const customer = pledge?.consumer_id
    ? await readCustomer(admin, pledge.consumer_id, pledge.livemode)
    : null;
  if (!pledge || !pledge.stripe_payment_method_id || !customer || pledge.status !== "ready") {
    await settle(admin, stripe, period.id, "declined", null);
    return "declined";
  }
  const email = pledge.consumer_id ? await readAuthEmail(admin, pledge.consumer_id) : null;
  let pi: Record<string, unknown> | undefined;
  let error: unknown;
  try {
    pi = await stripe(
      "POST",
      "payment_intents",
      renewalChargeParams({
        amountCents: period.price_cents,
        customer,
        paymentMethod: pledge.stripe_payment_method_id,
        receiptEmail: email,
        periodId: period.id,
        backingId: pledge.id,
        placeId: period.place_id,
        // An unknown tier names no level (MESITA-3041: never the wrong one).
        label: `${PREMIER_LABEL[TIER_BY_RANK[period.tier as TierRank]] ?? "Premier"} renewal`,
      }),
      { idempotencyKey: chargeKey(period.id) },
    );
  } catch (err) {
    error = err;
  }
  const outcome = chargeOutcome({ pi, error });
  const piId = idOf(pi) ?? idOf((error as { payment_intent?: unknown } | undefined)?.payment_intent);
  if (outcome === "paid" || outcome === "declined") {
    await settle(admin, stripe, period.id, outcome, piId);
    return outcome;
  }
  if (now - Date.parse(period.created_at) >= CHARGING_GIVE_UP_MS) {
    console.error("[premier] charge_give_up", JSON.stringify({ period_id: period.id, error: errorMessage(error) }));
    await settle(admin, stripe, period.id, "declined", piId);
    return "declined";
  }
  console.error("[premier] charge_unknown", JSON.stringify({ period_id: period.id, error: error ? errorMessage(error) : String(pi?.status) }));
  return "unknown";
}

/** Renew one place's subscription once its paid period ends: one charge to
 *  the payer's saved card. A charge already in flight is settled first; an
 *  answer not known yet is asked again on the next run. A subscription that
 *  Manual Premier covered for longer than one interval ends (`covered`)
 *  instead, and its card is detached. */
export async function renewPlace(
  admin: SupabaseClient,
  stripe: StripeCall,
  placeId: string,
  now = Date.now(),
): Promise<"idle" | "paid" | "declined" | "unknown"> {
  const { data, error } = await admin.rpc("premier_begin_renewal", { p_place_id: placeId });
  if (error) throw new Error(`premier_begin_renewal: ${error.message}`);
  const step = data as { action: "none" | "resolve" | "charge"; period_id?: string; reason?: string; payment_method?: string | null };
  if (step.action === "none") {
    if (step.reason === "dormant") await detachCard(stripe, step.payment_method);
    return "idle";
  }
  const period = await readPeriod(admin, step.period_id!);
  if (!period) return "unknown";
  return await settleCharging(admin, stripe, period, now);
}

/** A pledge ends at its guest's (or the admin's) request: an open Checkout
 *  is expired, the saved card detached. A payer's period already paid runs
 *  out; nothing renews it (stopping renewal). */
export async function leavePledge(
  admin: SupabaseClient,
  stripe: StripeCall | null,
  pledge: Pledge,
  reason: "stopped" | "stopped_by_place" | "left",
): Promise<void> {
  if (pledge.stripe_checkout_session_id && pledge.checkout_kind && stripe) {
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(pledge.stripe_checkout_session_id)}/expire`);
    } catch (err) {
      // Already complete or expired: nothing payable is left open.
      console.error("[premier] leave_expire", pledge.id, errorMessage(err));
    }
  }
  await endPledge(admin, stripe, pledge, reason);
}

/** Account deletion (consumer-web-delete-account): every charge in flight on
 *  the guest's pledges is settled first (a charge still unknown refuses the
 *  deletion; it is asked again), then every pledge ends (`left`). */
export async function endConsumerPledges(
  admin: SupabaseClient,
  consumerId: string,
  stripe: StripeCall | null,
): Promise<{ ok: true; ended: number } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("place_backings")
    .select(PLEDGE_COLUMNS)
    .eq("consumer_id", consumerId)
    .in("status", ["open", "ready"]);
  if (error) return { ok: false, error: `pledges_read: ${error.message}` };
  const pledges = (data ?? []) as Pledge[];
  if (pledges.length === 0) return { ok: true, ended: 0 };
  if (!stripe) return { ok: false, error: "premier_end: payments unavailable" };
  const { data: charging, error: chErr } = await admin
    .from("place_premier_periods")
    .select(PERIOD_COLUMNS)
    .in("backing_id", pledges.map((p) => p.id))
    .eq("status", "charging");
  if (chErr) return { ok: false, error: `periods_read: ${chErr.message}` };
  try {
    for (const period of (charging ?? []) as Period[]) {
      if ((await settleCharging(admin, stripe, period)) === "unknown") {
        return { ok: false, error: "premier_end: a charge is still in flight" };
      }
    }
    for (const pledge of pledges) {
      const fresh = await readPledge(admin, pledge.id);
      if (fresh && fresh.status !== "ended") await leavePledge(admin, stripe, fresh, "left");
    }
  } catch (err) {
    return { ok: false, error: `premier_end: ${errorMessage(err)}` };
  }
  return { ok: true, ended: pledges.length };
}

function idOf(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return null;
}

async function readAuthEmail(admin: SupabaseClient, consumerId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(consumerId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

// Premier (MESITA-2925; Boost MESITA-2789, Spotlight MESITA-1998 before it;
// code names keep `boost`).
//
// Paid Premier is ONE subscription per place (MESITA-3092, Pato 2026-10-29:
// "solo una suscripción activa"): the place's one `ready` pledge is its
// subscription and its guest is the payer. Anyone signed in buys when no
// paid Premier runs; nobody else can buy while it runs. The payer changes
// plan, updates the card, stops renewing (their period runs out) or resumes.
// A declined first charge leaves nothing; a declined renewal ends the
// subscription at once (no retry, no backups). An upgrade pays the new price
// minus the unused paid part of the running period; leftover credit becomes
// extra days.
//
//   place_backings          pledges: open (a Checkout), ready (THE
//                           subscription, at most one per place), ended
//   place_premier_periods   the paid stretches
//   place_manual_premier    Manual Premier, Mesita's free lift (MESITA-3091)
//   premier_customers       one Stripe customer per guest
// places.boost_tier is the higher of the running Manual and paid levels.
// Nothing is sold or charged at or below the running Manual level, and
// Manual at or above the paid level pauses the paid period (its end moves
// out by the covered time).
//
// Mesita runs the periods: Checkout saves the card (pays now: `payment` with
// a MANUAL capture, captured only once the quote is confirmed under the
// place lock; saves only: `setup`), renewals are off-session PaymentIntents.
// No subscriptions, no webhook (the EF name is the ACL): the 5-minute
// supabase-cron-sync-premier confirms abandoned Checkouts, settles charges in
// flight and runs renewals. Every period write is a `premier_*` RPC, and a
// pledge becomes `ready` only through premier_make_payer.
//
// Plans are sold yearly only since MESITA-3285 (Pato: "Plans become yearly
// only: Pro 99, Max 999"). Prices are an operator setting (MESITA-3043,
// `premier.yearlyCents` on discovery_config, Admin › Discovery ›
// Premier Prices); PREMIER_YEARLY_CENTS is only its default. The promise to
// guests already paying holds without a PR: a quote's price is stored on the
// pledge (`amount_cents`) and the period (`price_cents`) when it is bought,
// and every renewal charges the stored amount at the stored interval, so a
// monthly subscription bought before MESITA-3285 renews monthly at its price
// until its payer changes plan or leaves; a new price or interval reaches
// new purchases and plan changes only.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { isAllowedReturnUrl, StripeError } from "./stripe.ts";

export type BoostTier = "boost_2x" | "boost_5x";
export type BoostInterval = "month" | "year";

export const PREMIER_TIERS = ["boost_2x", "boost_5x"] as const satisfies readonly BoostTier[];

/** Yearly price per tier, in US cents. */
export type PremierPrices = Record<BoostTier, number>;

/** The DEFAULT yearly price in US cents, read when the operator's
 *  `premier.yearlyCents` is unset: Pro (2X) $99, Max (5X) $999 a year
 *  (Pato, MESITA-3285; $10 / $100 a month or ten months for twelve before). */
export const PREMIER_YEARLY_CENTS: PremierPrices = {
  boost_2x: 9900,
  boost_5x: 99900,
};

/** The one interval a plan is sold at (MESITA-3285). "month" survives only on
 *  pledges and periods bought before it. */
export const PREMIER_SOLD_INTERVAL = "year" satisfies BoostInterval;

export const PREMIER_CURRENCY = "usd";

/** Stripe refuses a USD charge under 50 cents; an upgrade whose credit
 *  leaves less than that is charged nothing. */
export const MIN_CHARGE_CENTS = 50;

/** A Checkout lives this long (Stripe's minimum is 30 minutes). */
export const CHECKOUT_TTL_SEC = 31 * 60;

/** A charge still unknown after this long is cancelled and declined. */
export const CHARGING_GIVE_UP_MS = 24 * 3600_000;

/** The Stripe product line's name: the plan, never its multiplier (Pato,
 *  MESITA-3916: "also the name of the stripe products"; "Premier 2X/5X" from
 *  MESITA-2925 until then). The wire tiers keep their stored `boost_*` keys,
 *  and the 2 and 5 live on in PREMIER_FACTOR below. */
export const PREMIER_LABEL: Record<BoostTier, string> = {
  boost_2x: "Mesita Pro",
  boost_5x: "Mesita Max",
};
/** What each plan gives, in the guest's words (MESITA-3906/3910). */
export const PREMIER_PERK: Record<BoostTier, string> = {
  boost_2x: "High visibility boost",
  boost_5x: "Max visibility boost",
};

/** The Premier factor a place's `boost_tier` (0..2) earns in the Area
 *  score. The 2 and the 5 are Discovery's anchors: every other ranking knob
 *  was tuned against them (Pato, MESITA-3916), so renaming what guests read
 *  never touches them. */
export const PREMIER_FACTOR: Record<0 | 1 | 2, number> = { 0: 1, 1: 2, 2: 5 };

export type TierRank = 1 | 2;

export const TIER_RANK: Record<BoostTier, TierRank> = { boost_2x: 1, boost_5x: 2 };
export const TIER_BY_RANK: Record<TierRank, BoostTier> = { 1: "boost_2x", 2: "boost_5x" };

/** A place's stored `boost_tier` as a Premier rank: 1 or 2, else 0 (an
 *  unknown value never reads as Premier, MESITA-3041). */
export function premierRankOf(boostTier: number): 0 | TierRank {
  return boostTier === 1 || boostTier === 2 ? boostTier : 0;
}

/** What a new year of `tier` costs, at the operator's yearly prices
 *  (`loadPremierPrices`; the defaults when none are passed). */
export function boostAmountCents(tier: BoostTier, prices: PremierPrices = PREMIER_YEARLY_CENTS): number {
  return prices[tier];
}

/** Calendar interval, like the SQL `premier_interval_end`: one month or one
 *  year after `start` (UTC), plus whole extra days. */
export function intervalEnd(start: Date, interval: BoostInterval, extraDays = 0): Date {
  const d = new Date(start.getTime());
  if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.floor(extraDays)));
  return d;
}

// ── Rows ──────────────────────────────────────────────────────────────────

export type PledgeStatus = "open" | "ready" | "ended";

/** Why an ended pledge ended (place_backings.ended_reason, MESITA-3092). */
export type EndedReason =
  | "declined"
  | "stopped"
  | "stopped_by_place"
  | "taken_over"
  | "left"
  | "checkout_failed"
  | "lost"
  | "covered";

/** The Checkout in flight on a pledge (also its Stripe metadata `kind`). */
export type CheckoutKind = "buy" | "change" | "resume" | "update_card";

export type Pledge = {
  id: string;
  place_id: string;
  consumer_id: string | null;
  tier: BoostTier;
  billing_interval: BoostInterval;
  amount_cents: number;
  status: PledgeStatus;
  queued_at: string;
  stripe_payment_method_id: string | null;
  stripe_checkout_session_id: string | null;
  pending_tier: BoostTier | null;
  pending_interval: BoostInterval | null;
  pending_amount_cents: number | null;
  quoted_period_id: string | null;
  quoted_credit_cents: number;
  livemode: boolean;
  created_at: string;
  ended_at: string | null;
  ended_reason: EndedReason | null;
  checkout_kind: CheckoutKind | null;
  notice_dismissed_at: string | null;
  /** Subscribed early, first charged when the Refill days end (MESITA-3165). */
  early_start?: boolean;
};

export const PLEDGE_COLUMNS =
  "id, place_id, consumer_id, tier, billing_interval, amount_cents, status, queued_at, stripe_payment_method_id, stripe_checkout_session_id, pending_tier, pending_interval, pending_amount_cents, quoted_period_id, quoted_credit_cents, livemode, created_at, ended_at, ended_reason, checkout_kind, notice_dismissed_at, early_start";

export type PeriodStatus = "charging" | "paid" | "declined" | "replaced" | "ended";

export type Period = {
  id: string;
  place_id: string;
  backing_id: string | null;
  granted_by: string | null;
  tier: number;
  billing_interval: BoostInterval;
  starts_at: string;
  ends_at: string;
  price_cents: number;
  credit_cents: number;
  extra_days: number;
  charged_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: PeriodStatus;
  created_at: string;
  /** Paid seconds left when Manual Premier began covering it (MESITA-3092). */
  remaining_at_cover_sec: number | null;
  covered_until: string | null;
};

export const PERIOD_COLUMNS =
  "id, place_id, backing_id, granted_by, tier, billing_interval, starts_at, ends_at, price_cents, credit_cents, extra_days, charged_cents, stripe_payment_intent_id, stripe_checkout_session_id, status, created_at, remaining_at_cover_sec, covered_until";

/** Premier Refill (was Manual Premier, MESITA-3091 / MESITA-3163): prepaid
 *  days lifting a place. */
export type Manual = {
  id: string;
  place_id: string;
  tier: number;
  starts_at: string;
  ends_at: string;
  source: "admin" | "purchase";
  granted_by: string | null;
  /** When the grant was made (Billing's moved date, MESITA-3166). */
  created_at?: string;
};

export const MANUAL_COLUMNS = "id, place_id, tier, starts_at, ends_at, source, granted_by, created_at";

// ── The subscription, in pure functions ───────────────────────────────────

const ms = (iso: string) => Date.parse(iso);

/** The paid period covering `now`. */
export function runningPeriod(periods: Period[], now: number): Period | null {
  return periods
    .filter((p) => p.status === "paid" && ms(p.starts_at) <= now && ms(p.ends_at) > now)
    .sort((a, b) => ms(b.starts_at) - ms(a.starts_at))[0] ?? null;
}

/** The Manual Premier row covering `now`. */
export function runningManual(rows: Manual[], now: number): Manual | null {
  return rows
    .filter((m) => ms(m.starts_at) <= now && ms(m.ends_at) > now)
    .sort((a, b) => ms(b.starts_at) - ms(a.starts_at))[0] ?? null;
}

/** When the back-to-back run of Refill days at or above `tier` ends, or null
 *  when none of them runs at `now`. Zero-length rows (ended while queued)
 *  never count. Twin of SQL premier_run_end (MESITA-3165). */
export function runEndAtOrAbove(rows: Manual[], tier: number, now: number): string | null {
  const chain = rows
    .filter((m) => m.tier >= tier && ms(m.ends_at) > now && ms(m.ends_at) > ms(m.starts_at))
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
  let cursor = now;
  for (const m of chain) {
    if (ms(m.starts_at) > cursor) break;
    cursor = Math.max(cursor, ms(m.ends_at));
  }
  return cursor > now ? new Date(cursor).toISOString() : null;
}

/** Subscribe early: the last days of a Refill run in which its level may be
 *  subscribed to, first charged when the run ends (Design D7, MESITA-3165). */
export const EARLY_START_DAYS = 7;

/** The calendar day of `t` in `timeZone` (UTC when missing or unknown), as a
 *  day number. */
export function localDay(t: number, timeZone: string | null | undefined): number {
  let text: string;
  try {
    text = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(t);
  } catch {
    text = new Date(t).toISOString().slice(0, 10);
  }
  return Math.round(Date.parse(`${text}T00:00:00Z`) / 86_400_000);
}

/** The run ends within EARLY_START_DAYS calendar days in the place's time
 *  zone (twin of SQL premier_early_window). */
export function inEarlyWindow(runEnd: string, now: number, timeZone: string | null | undefined): boolean {
  return localDay(ms(runEnd), timeZone) - localDay(now, timeZone) <= EARLY_START_DAYS;
}

/** A charge in flight; it holds the tier for up to an hour after it starts. */
export function chargingPeriod(periods: Period[]): Period | null {
  return periods.find((p) => p.status === "charging") ?? null;
}

/** The place's one Paid subscription: its `ready` pledge. */
export function subscriptionOf(pledges: Pledge[]): Pledge | null {
  return pledges.find((p) => p.status === "ready") ?? null;
}

/** The unused value of a paid period at `now`: its price times the share of
 *  its PAID length still ahead. Time Manual Premier covered is not paid time
 *  (MESITA-3092): while covered, what was left when the cover began; after,
 *  that minus the time since the cover ended. A grant (price 0) credits
 *  nothing. */
export function creditCents(p: Period | null, now: number): number {
  if (!p || p.status !== "paid" || p.price_cents <= 0) return 0;
  const start = ms(p.starts_at);
  const end = ms(p.ends_at);
  if (now >= end) return 0;
  let length: number;
  let remaining: number;
  if (p.remaining_at_cover_sec != null && p.covered_until) {
    length = intervalEnd(new Date(start), p.billing_interval, p.extra_days).getTime() - start;
    remaining = p.remaining_at_cover_sec * 1000 - Math.max(0, now - ms(p.covered_until));
  } else {
    length = end - start;
    remaining = end - Math.max(now, start);
  }
  if (!(length > 0)) return 0;
  remaining = Math.max(0, Math.min(remaining, length));
  return Math.floor((p.price_cents * remaining) / length);
}

/** Leftover credit above the new price, as whole days of the new period. */
export function extraDays(leftoverCents: number, priceCents: number, interval: BoostInterval, now: number): number {
  if (leftoverCents <= 0 || priceCents <= 0) return 0;
  const start = new Date(now);
  const days = (intervalEnd(start, interval).getTime() - now) / 86_400_000;
  return Math.floor((leftoverCents / priceCents) * days);
}

/** Who is looking at a place's Premier: the payer (their pledge is the
 *  subscription), the former payer (they stopped renewing; the period they
 *  paid still runs and nobody else subscribed), or anyone else. */
export type Viewer = "payer" | "former_payer" | "stranger";

export function viewerOf(args: {
  consumerId: string;
  subscription: Pledge | null;
  running: Period | null;
  pledges: Pledge[];
}): Viewer {
  const { consumerId, subscription, running, pledges } = args;
  if (subscription?.consumer_id === consumerId) return "payer";
  if (!subscription && running?.backing_id) {
    const paidBy = pledges.find((p) => p.id === running.backing_id);
    if (paidBy?.consumer_id === consumerId) return "former_payer";
  }
  return "stranger";
}

/** The former payer may resume renewing: their own pledge ended `stopped`,
 *  the period it paid runs, nobody else subscribed, nothing is charging. */
export function canResume(args: { viewer: Viewer; running: Period | null; pledges: Pledge[]; charging: boolean }): boolean {
  if (args.viewer !== "former_payer" || !args.running || args.charging) return false;
  const paidBy = args.pledges.find((p) => p.id === args.running!.backing_id);
  return paidBy?.status === "ended" && paidBy.ended_reason === "stopped";
}

export type QuoteKind = "buy" | "change" | "resume" | "blocked";

export type Quote = {
  /** The level's full price per interval (what renewals charge). */
  price_cents: number;
  /** Charged today, after credit; 0 when nothing is charged. */
  charge_cents: number;
  credit_cents: number;
  extra_days: number;
  /** When the new period would end, when it starts now. */
  new_ends_at: string | null;
  /** When the new terms are first charged, when they wait for the running
   *  period's end (a change down, or a resume). */
  renews_at: string | null;
  /** buy: a place with no subscription; change: the payer's (or the former
   *  payer's) new terms; resume: the former payer renews again; blocked:
   *  not for this guest now (see `blocked_by`). */
  kind: QuoteKind;
  blocked_by: "taken" | "charging" | null;
  /** What it takes: pay now, save a card, or nothing (a change applied at
   *  the next renewal, or an upgrade the credit covers on a saved card). */
  checkout: "payment" | "setup" | "none";
  /** Manual Premier already gives this level or more: not for sale. */
  covered: boolean;
};

/** What choosing `tier` (a year of it) means for this guest right now. The UI
 *  shows exactly this; it never computes money. */
export function quote(args: {
  tier: BoostTier;
  running: Period | null;
  charging: boolean;
  viewer: Viewer;
  /** The place's one subscription (its ready pledge), if any. */
  subscription: Pledge | null;
  now: number;
  /** The running Manual Premier level (0 none, 1 2X, 2 5X). */
  manualTier?: number;
  /** The place's Refill rows and time zone, for subscribing early. */
  manual?: Manual[];
  timeZone?: string | null;
  /** The operator's yearly prices (MESITA-3043); the defaults if absent. */
  prices?: PremierPrices;
}): Quote {
  const { tier, running, charging, viewer, subscription, now, manualTier = 0 } = args;
  const interval = PREMIER_SOLD_INTERVAL;
  const price = boostAmountCents(tier, args.prices);
  const rank = TIER_RANK[tier];
  const nothing = { price_cents: price, charge_cents: 0, credit_cents: 0, extra_days: 0, new_ends_at: null, renews_at: null };

  // Manual Premier already gives this level or more: paying would change
  // nothing, so it is not for sale (MESITA-3091). In the run's last 7 days a
  // place nobody pays for may subscribe early: the card is saved now and
  // first charged when the days end (MESITA-3165; premier_make_payer decides).
  if (rank <= manualTier) {
    const runEnd = args.manual ? runEndAtOrAbove(args.manual, rank, now) : null;
    if (runEnd && !subscription && !running && !charging && inEarlyWindow(runEnd, now, args.timeZone)) {
      return { ...nothing, renews_at: runEnd, kind: "resume", blocked_by: null, checkout: "setup", covered: false };
    }
    return { ...nothing, kind: "blocked", blocked_by: null, checkout: "none", covered: true };
  }
  // One subscription per place: nobody else buys while one stands or a paid
  // period runs (R2).
  if (viewer === "stranger" && (subscription || running)) {
    return { ...nothing, kind: "blocked", blocked_by: "taken", checkout: "none", covered: false };
  }
  if (charging) {
    return { ...nothing, kind: "blocked", blocked_by: "charging", checkout: "none", covered: false };
  }

  const owns = viewer === "payer" || viewer === "former_payer";
  // At or below the running level: the period already paid runs on; the
  // new terms are first charged when it ends.
  if (owns && running && rank <= running.tier) {
    return viewer === "payer"
      ? { ...nothing, renews_at: running.ends_at, kind: "change", blocked_by: null, checkout: "none", covered: false }
      : { ...nothing, renews_at: running.ends_at, kind: "resume", blocked_by: null, checkout: "setup", covered: false };
  }

  // Starts now: a first purchase at full price, or an upgrade that takes the
  // unused paid part of the guest's own running period off the price.
  const credit = owns ? creditCents(running, now) : 0;
  const leftover = credit - price;
  let charge = Math.max(0, price - credit);
  if (charge > 0 && charge < MIN_CHARGE_CENTS) charge = 0;
  const days = extraDays(leftover, price, interval, now);
  const hasCard = viewer === "payer" && !!subscription?.stripe_payment_method_id;
  return {
    price_cents: price,
    charge_cents: charge,
    credit_cents: Math.min(credit, price),
    extra_days: days,
    new_ends_at: intervalEnd(new Date(now), interval, days).toISOString(),
    renews_at: null,
    kind: owns ? "change" : "buy",
    blocked_by: null,
    checkout: charge > 0 ? "payment" : hasCard ? "none" : "setup",
    covered: false,
  };
}

/** Every tier, a year of it, for the plan rows (the only interval sold
 *  since MESITA-3285). */
export function quotes(args: Omit<Parameters<typeof quote>[0], "tier">): Record<BoostTier, { year: Quote }> {
  const out = {} as Record<BoostTier, { year: Quote }>;
  for (const tier of PREMIER_TIERS) out[tier] = { year: quote({ ...args, tier }) };
  return out;
}

/** What a charge attempt's answer means. Only a card decline (or a charge
 *  that needs the guest) is a decline; anything else is not known yet and
 *  is asked again with the same key. */
export type ChargeOutcome = "paid" | "declined" | "unknown";

export function chargeOutcome(result: { pi?: Record<string, unknown>; error?: unknown }): ChargeOutcome {
  if (result.error) {
    const e = result.error;
    if (e instanceof StripeError && (e.type === "card_error" || e.code === "authentication_required")) {
      return "declined";
    }
    return "unknown";
  }
  const status = String(result.pi?.status ?? "");
  if (status === "succeeded") return "paid";
  if (status === "requires_action" || status === "requires_payment_method" || status === "canceled") return "declined";
  return "unknown";
}

/** What a stored PaymentIntent that has been charging too long gets. */
export function staleChargeAction(status: string): "paid" | "wait" | "cancel" {
  if (status === "succeeded") return "paid";
  if (status === "processing") return "wait";
  return "cancel";
}

/** Stable keys: one per attempt row, so a retry after a timeout returns the
 *  same PaymentIntent instead of charging twice. */
export const chargeKey = (periodId: string) => `premier-charge:${periodId}`;
export const captureKey = (paymentIntentId: string) => `premier-capture:${paymentIntentId}`;
export const customerKey = (consumerId: string, livemode: boolean) =>
  `premier-customer:${consumerId}:${livemode ? "live" : "test"}`;

// ── Start: parse and guard ────────────────────────────────────────────────

export type BoostStart = {
  placeId: string;
  tier: BoostTier;
  interval: BoostInterval;
  returnUrl: string;
  /** The payer replaces the saved card (a setup Checkout); tier and
   *  interval are ignored. */
  updateCard: boolean;
};

export function parseBoostStart(
  body: Record<string, unknown>,
): { ok: true; start: BoostStart } | { ok: false; error: string; code?: "tier_retired" | "tier_invalid" | "interval_retired" } {
  const placeId = body.place_id;
  if (!isUuid(placeId)) return { ok: false, error: "place_id must be a Mesita place id" };
  const returnUrl = body.return_url;
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return { ok: false, error: "return_url is not a Mesita address" };
  }
  if (body.kind === "update_card") {
    return { ok: true, start: { placeId, tier: "boost_2x", interval: PREMIER_SOLD_INTERVAL, returnUrl, updateCard: true } };
  }
  const tier = body.tier;
  if (tier === "boost_10x") {
    // Retired by MESITA-3041; a cached old build may still offer it.
    return { ok: false, code: "tier_retired", error: 'tier "boost_10x" is not offered; use boost_2x or boost_5x' };
  }
  if (typeof tier !== "string" || !(PREMIER_TIERS as readonly string[]).includes(tier)) {
    return {
      ok: false,
      code: "tier_invalid",
      error: `tier ${JSON.stringify(String(tier).slice(0, 32))} is not offered; use boost_2x or boost_5x`,
    };
  }
  const interval = body.interval ?? PREMIER_SOLD_INTERVAL;
  if (interval === "month") {
    // Retired by MESITA-3285; a cached old build may still send it.
    return { ok: false, code: "interval_retired", error: "Plans are yearly only now. Reload the page and choose again." };
  }
  if (interval !== PREMIER_SOLD_INTERVAL) return { ok: false, error: "interval must be year" };
  return { ok: true, start: { placeId, tier: tier as BoostTier, interval, returnUrl, updateCard: false } };
}

/** The Checkout that saves a guest's card for a pledge. `payment` charges the
 *  quoted amount, held (manual capture) until the quote is confirmed;
 *  `setup` only saves the card. Metadata carries the quote the server made
 *  and what the Checkout is for (`kind`), so confirm never trusts the
 *  browser. */
export function pledgeCheckoutParams(args: {
  mode: "payment" | "setup";
  kind: CheckoutKind;
  customer: string;
  backingId: string;
  placeId: string;
  consumerId: string;
  tier: BoostTier;
  interval: BoostInterval;
  quote: Quote;
  placeName: string;
  returnUrl: string;
  nowSec: number;
}): Record<string, unknown> {
  const sep = args.returnUrl.includes("?") ? "&" : "?";
  const metadata = {
    mesita_kind: "premier",
    backing_id: args.backingId,
    place_id: args.placeId,
    consumer_id: args.consumerId,
    tier: args.tier,
    interval: args.interval,
    // The quote's own price: the one the guest was shown (MESITA-3043).
    price_cents: String(args.quote.price_cents),
    credit_cents: String(args.quote.credit_cents),
    extra_days: String(args.quote.extra_days),
    charge_cents: String(args.quote.charge_cents),
    kind: args.kind,
  };
  const common = {
    customer: args.customer,
    client_reference_id: args.backingId,
    success_url: `${args.returnUrl}${sep}boost={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + CHECKOUT_TTL_SEC,
    metadata,
  };
  if (args.mode === "setup") {
    return { ...common, mode: "setup", currency: PREMIER_CURRENCY, setup_intent_data: { metadata } };
  }
  return {
    ...common,
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: PREMIER_CURRENCY,
        unit_amount: args.quote.charge_cents,
        product_data: { name: `${PREMIER_LABEL[args.tier]} · ${PREMIER_PERK[args.tier]} · ${args.placeName}`.slice(0, 250) },
      },
    }],
    payment_intent_data: {
      capture_method: "manual",
      setup_future_usage: "off_session",
      metadata,
    },
  };
}

/** One renewal charge: the payer's saved card, off session. */
export function renewalChargeParams(args: {
  amountCents: number;
  customer: string;
  paymentMethod: string;
  receiptEmail: string | null;
  periodId: string;
  backingId: string;
  placeId: string;
  label: string;
}): Record<string, unknown> {
  return {
    amount: args.amountCents,
    currency: PREMIER_CURRENCY,
    customer: args.customer,
    payment_method: args.paymentMethod,
    off_session: true,
    confirm: true,
    description: args.label,
    ...(args.receiptEmail ? { receipt_email: args.receiptEmail } : {}),
    metadata: {
      mesita_kind: "premier",
      period_id: args.periodId,
      backing_id: args.backingId,
      place_id: args.placeId,
    },
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function readPledge(admin: SupabaseClient, id: string): Promise<Pledge | null> {
  const { data, error } = await admin.from("place_backings").select(PLEDGE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`pledge_read: ${error.message}`);
  return (data as Pledge | null) ?? null;
}

export async function readPeriod(admin: SupabaseClient, id: string): Promise<Period | null> {
  const { data, error } = await admin.from("place_premier_periods").select(PERIOD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`period_read: ${error.message}`);
  return (data as Period | null) ?? null;
}

export async function readCustomer(admin: SupabaseClient, consumerId: string, livemode: boolean): Promise<string | null> {
  const { data, error } = await admin
    .from("premier_customers")
    .select("stripe_customer")
    .eq("consumer_id", consumerId)
    .eq("livemode", livemode)
    .maybeSingle();
  if (error) throw new Error(`customer_read: ${error.message}`);
  return (data as { stripe_customer: string } | null)?.stripe_customer ?? null;
}

/** A place's pledges (live ones, and those ended in the last 400 days: the
 *  running period's payer and the ended notices), its recent paid periods
 *  and its recent Manual Premier rows (what get-premier, start-premier and
 *  the admin read). */
export async function readLine(
  admin: SupabaseClient,
  placeId: string,
  opts: { periodsSince?: number; allPledges?: boolean } = {},
): Promise<{ ok: true; pledges: Pledge[]; periods: Period[]; manual: Manual[] } | { ok: false; error: string }> {
  const since = new Date(opts.periodsSince ?? Date.now() - 2 * 3600_000).toISOString();
  let pledgeQuery = admin.from("place_backings").select(PLEDGE_COLUMNS).eq("place_id", placeId);
  if (!opts.allPledges) {
    const endedSince = new Date(Date.now() - 400 * 86_400_000).toISOString();
    pledgeQuery = pledgeQuery.or(`status.in.(open,ready),ended_at.gte.${endedSince}`);
  }
  const [pRes, perRes, manRes] = await Promise.all([
    pledgeQuery.order("created_at", { ascending: true }),
    admin
      .from("place_premier_periods")
      .select(PERIOD_COLUMNS)
      .eq("place_id", placeId)
      .gte("ends_at", since)
      .order("starts_at", { ascending: false })
      .limit(50),
    admin
      .from("place_manual_premier")
      .select(MANUAL_COLUMNS)
      .eq("place_id", placeId)
      .gte("ends_at", since)
      .order("starts_at", { ascending: false })
      .limit(50),
  ]);
  if (pRes.error) return { ok: false, error: `pledges_read: ${pRes.error.message}` };
  if (perRes.error) return { ok: false, error: `periods_read: ${perRes.error.message}` };
  if (manRes.error) return { ok: false, error: `manual_read: ${manRes.error.message}` };
  return {
    ok: true,
    pledges: (pRes.data ?? []) as Pledge[],
    periods: (perRes.data ?? []) as Period[],
    manual: (manRes.data ?? []) as Manual[],
  };
}

/** The place a pledge is for, through the browse view: name, state and
 *  its current tier. */
export async function readBoostPlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<
  | {
    ok: true;
    place: { id: string; name: string | null; state: string | null; boost_tier: number; timezone: string | null } | null;
  }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, state, boost_tier, timezone")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return { ok: false, error: `place_read: ${error.message}` };
  return { ok: true, place: data ?? null };
}

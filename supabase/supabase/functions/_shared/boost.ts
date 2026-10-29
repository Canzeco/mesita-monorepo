// Premier's line (MESITA-2995; Premier since MESITA-2925, Boost MESITA-2789,
// Spotlight MESITA-1998 before it; code names keep `boost`).
//
// Many guests may pledge for one place, but only ONE pledge pays per period:
// the payer. Everyone else is a backup and is charged nothing until a
// renewal reaches them because every card above them failed (Pato,
// 2026-10-28). A pledge above the running period's level becomes the payer
// at once and pays the new price minus the unused part of the running
// period (the credit is the place's, whoever upgrades); leftover credit
// becomes extra days.
//
//   place_backings          the line: one pledge per guest per place
//   place_premier_periods   the paid stretches; places.boost_tier follows them
//   premier_customers       one Stripe customer per guest
//
// Mesita runs the periods: Checkout saves the card (pays now: `payment` with
// a MANUAL capture, captured only once the quote is confirmed under the
// place lock; waits: `setup`), renewals are off-session PaymentIntents.
// No subscriptions, no webhook (the EF name is the ACL): the 5-minute
// supabase-cron-sync-boosts confirms abandoned Checkouts, settles charges in
// flight and runs renewals. Every period write is a `premier_*` RPC.
//
// decision: prices are fixed here, not a console knob — a price is a money
// promise to the guests already pledged, so it changes by PR.
// decision (Pato, MESITA-2789): a yearly pledge costs ten months for twelve.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { errorMessage } from "./errors.ts";

export type BoostTier = "boost_2x" | "boost_5x" | "boost_10x";
export type BoostInterval = "month" | "year";

export const PREMIER_TIERS = ["boost_2x", "boost_5x", "boost_10x"] as const satisfies readonly BoostTier[];

/** Monthly price in US cents. */
export const PREMIER_MONTHLY_CENTS: Record<BoostTier, number> = {
  boost_2x: 1000,
  boost_5x: 5000,
  boost_10x: 20000,
};

/** A year is billed as this many months. */
export const PREMIER_YEAR_MONTHS = 10;

export const PREMIER_CURRENCY = "usd";

/** Stripe refuses a USD charge under 50 cents; an upgrade whose credit
 *  leaves less than that is charged nothing. */
export const MIN_CHARGE_CENTS = 50;

/** A Checkout lives this long (Stripe's minimum is 30 minutes). */
export const CHECKOUT_TTL_SEC = 31 * 60;

/** A charge still unknown after this long is cancelled and declined. */
export const CHARGING_GIVE_UP_MS = 24 * 3600_000;

/** The Stripe product line's name (MESITA-2925). The wire tiers keep their
 *  stored `boost_*` keys. */
export const PREMIER_LABEL: Record<BoostTier, string> = {
  boost_2x: "Premier 2X",
  boost_5x: "Premier 5X",
  boost_10x: "Premier 10X",
};

/** The Premier factor a place's `boost_tier` (0..3) earns in the Area
 *  score. Literal: the tier names promise the number. */
export const PREMIER_FACTOR: Record<0 | 1 | 2 | 3, number> = { 0: 1, 1: 2, 2: 5, 3: 10 };

export type TierRank = 1 | 2 | 3;

export const TIER_RANK: Record<BoostTier, TierRank> = { boost_2x: 1, boost_5x: 2, boost_10x: 3 };
export const TIER_BY_RANK: Record<TierRank, BoostTier> = { 1: "boost_2x", 2: "boost_5x", 3: "boost_10x" };

/** What the guest pays per interval. */
export function boostAmountCents(tier: BoostTier, interval: BoostInterval): number {
  const monthly = PREMIER_MONTHLY_CENTS[tier];
  return interval === "year" ? monthly * PREMIER_YEAR_MONTHS : monthly;
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

export type PledgeStatus = "open" | "ready" | "failed" | "ended";

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
};

export const PLEDGE_COLUMNS =
  "id, place_id, consumer_id, tier, billing_interval, amount_cents, status, queued_at, stripe_payment_method_id, stripe_checkout_session_id, pending_tier, pending_interval, pending_amount_cents, quoted_period_id, quoted_credit_cents, livemode, created_at";

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
};

export const PERIOD_COLUMNS =
  "id, place_id, backing_id, granted_by, tier, billing_interval, starts_at, ends_at, price_cents, credit_cents, extra_days, charged_cents, stripe_payment_intent_id, stripe_checkout_session_id, status, created_at";

// ── The line, in pure functions ───────────────────────────────────────────

const ms = (iso: string) => Date.parse(iso);

/** The paid period covering `now` (a grant included). */
export function runningPeriod(periods: Period[], now: number): Period | null {
  return periods
    .filter((p) => p.status === "paid" && ms(p.starts_at) <= now && ms(p.ends_at) > now)
    .sort((a, b) => ms(b.starts_at) - ms(a.starts_at))[0] ?? null;
}

/** A charge in flight; it holds the tier for up to an hour after it starts. */
export function chargingPeriod(periods: Period[]): Period | null {
  return periods.find((p) => p.status === "charging") ?? null;
}

/** The unused value of a paid period at `now`: its price times the share of
 *  its length still ahead. A grant (price 0) credits nothing. */
export function creditCents(p: Period | null, now: number): number {
  if (!p || p.status !== "paid" || p.price_cents <= 0) return 0;
  const start = ms(p.starts_at);
  const end = ms(p.ends_at);
  const length = end - start;
  if (!(length > 0) || now >= end) return 0;
  const remaining = Math.min(end - Math.max(now, start), length);
  return Math.floor((p.price_cents * remaining) / length);
}

/** Leftover credit above the new price, as whole days of the new period. */
export function extraDays(leftoverCents: number, priceCents: number, interval: BoostInterval, now: number): number {
  if (leftoverCents <= 0 || priceCents <= 0) return 0;
  const start = new Date(now);
  const days = (intervalEnd(start, interval).getTime() - now) / 86_400_000;
  return Math.floor((leftoverCents / priceCents) * days);
}

/** Who a renewal charges, in order: ready pledges with a saved card, the
 *  higher level first, then whoever got in line first. */
export function ladder(pledges: Pledge[]): Pledge[] {
  return pledges
    .filter((p) => p.status === "ready" && p.stripe_payment_method_id)
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || ms(a.queued_at) - ms(b.queued_at));
}

export type LineRow = {
  tier: number;
  interval: BoostInterval;
  role: "payer" | "backup";
  position: number;
  mine: boolean;
};

export const LINE_SHOWN = 5;

/** The line a guest reads: the payer first (the current period's pledge,
 *  at the period's level), then the backups in ladder order. Top five, plus
 *  the caller's own row when it falls past them. Anonymous: no names. */
export function lineView(
  pledges: Pledge[],
  running: Period | null,
  consumerId: string | null,
): { line: LineRow[]; more: number } {
  const payerId = running?.backing_id ?? null;
  const rows: LineRow[] = [];
  const payer = payerId ? pledges.find((p) => p.id === payerId && p.status !== "ended") : undefined;
  if (payer && running) {
    rows.push({
      tier: running.tier,
      interval: payer.billing_interval,
      role: "payer",
      position: 0,
      mine: consumerId != null && payer.consumer_id === consumerId,
    });
  }
  ladder(pledges)
    .filter((p) => p.id !== payerId)
    .forEach((p, i) =>
      rows.push({
        tier: TIER_RANK[p.tier],
        interval: p.billing_interval,
        role: "backup",
        position: i + 1,
        mine: consumerId != null && p.consumer_id === consumerId,
      })
    );
  const shown = rows.slice(0, LINE_SHOWN);
  const mineLate = rows.slice(LINE_SHOWN).find((r) => r.mine);
  if (mineLate) shown.push(mineLate);
  return { line: shown, more: rows.length - shown.length };
}

export type Quote = {
  /** The level's full price per interval (what renewals charge). */
  price_cents: number;
  /** Charged today, after credit; 0 when nothing is charged. */
  charge_cents: number;
  credit_cents: number;
  extra_days: number;
  /** When the new period would end, for a payer quote. */
  new_ends_at: string | null;
  role: "payer" | "backup";
  /** Backup number (1 = next in line); 0 for a payer. */
  position: number;
  /** What the pledge takes: pay now, save a card, or nothing (an edit of a
   *  pledge whose card is already saved). */
  checkout: "payment" | "setup" | "none";
};

/** What choosing `tier`/`interval` means for this guest right now. The UI
 *  shows exactly this; it never computes money. */
export function quote(args: {
  tier: BoostTier;
  interval: BoostInterval;
  running: Period | null;
  charging: boolean;
  pledges: Pledge[];
  mine: Pledge | null;
  now: number;
}): Quote {
  const { tier, interval, running, charging, pledges, mine, now } = args;
  const price = boostAmountCents(tier, interval);
  const rank = TIER_RANK[tier];
  const hasCard = mine?.status === "ready" && !!mine.stripe_payment_method_id;
  const isPayer = !!mine && !!running && running.backing_id === mine.id;

  // The payer changing their own terms below or at the running level: the
  // period they paid runs on; the new terms apply at the next renewal.
  if (isPayer && running && rank <= running.tier) {
    return { price_cents: price, charge_cents: 0, credit_cents: 0, extra_days: 0, new_ends_at: null, role: "payer", position: 0, checkout: "none" };
  }

  if (!charging && (!running || rank > running.tier)) {
    const credit = creditCents(running, now);
    const leftover = credit - price;
    let charge = Math.max(0, price - credit);
    if (charge > 0 && charge < MIN_CHARGE_CENTS) charge = 0;
    const days = extraDays(leftover, price, interval, now);
    return {
      price_cents: price,
      charge_cents: charge,
      credit_cents: Math.min(credit, price),
      extra_days: days,
      new_ends_at: intervalEnd(new Date(now), interval, days).toISOString(),
      role: "payer",
      position: 0,
      checkout: charge > 0 ? "payment" : hasCard ? "none" : "setup",
    };
  }

  const myQueued = mine && mine.tier === tier && mine.status === "ready" ? ms(mine.queued_at) : Infinity;
  const ahead = ladder(pledges).filter((p) =>
    p.id !== mine?.id &&
    p.id !== running?.backing_id &&
    (TIER_RANK[p.tier] > rank || (TIER_RANK[p.tier] === rank && ms(p.queued_at) < myQueued))
  ).length;
  return {
    price_cents: price,
    charge_cents: 0,
    credit_cents: 0,
    extra_days: 0,
    new_ends_at: null,
    role: "backup",
    position: ahead + 1,
    checkout: hasCard ? "none" : "setup",
  };
}

/** Every tier × interval, for the tiles. */
export function quotes(args: Omit<Parameters<typeof quote>[0], "tier" | "interval">): Record<BoostTier, Record<BoostInterval, Quote>> {
  const out = {} as Record<BoostTier, Record<BoostInterval, Quote>>;
  for (const tier of PREMIER_TIERS) {
    out[tier] = {
      month: quote({ ...args, tier, interval: "month" }),
      year: quote({ ...args, tier, interval: "year" }),
    };
  }
  return out;
}

/** What a renewal attempt's answer means. Only a card decline (or a charge
 *  that needs the guest) moves to the next pledge; anything else is not
 *  known yet and is asked again with the same key. */
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
};

/** Checkout's return address: https on a Mesita or Vercel host (a preview
 *  must come back to itself), or a local dev host. Never anywhere else. */
export function isAllowedReturnUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol === "http:") return host === "localhost" || host === "127.0.0.1";
  if (u.protocol !== "https:") return false;
  return host === "mesita.ai" || host.endsWith(".mesita.ai") || host.endsWith(".vercel.app");
}

export function parseBoostStart(
  body: Record<string, unknown>,
): { ok: true; start: BoostStart } | { ok: false; error: string } {
  const placeId = body.place_id;
  if (!isUuid(placeId)) return { ok: false, error: "place_id must be a Mesita place id" };
  const tier = body.tier;
  if (typeof tier !== "string" || !(PREMIER_TIERS as readonly string[]).includes(tier)) {
    return { ok: false, error: "tier must be boost_2x, boost_5x or boost_10x" };
  }
  const interval = body.interval ?? "month";
  if (interval !== "month" && interval !== "year") {
    return { ok: false, error: "interval must be month or year" };
  }
  const returnUrl = body.return_url;
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return { ok: false, error: "return_url is not a Mesita address" };
  }
  return { ok: true, start: { placeId, tier: tier as BoostTier, interval, returnUrl } };
}

// ── Stripe ────────────────────────────────────────────────────────────────

type ReadEnv = (name: string) => string | undefined;
const envRead: ReadEnv = (name) => Deno.env.get(name);

function stripeLive(read: ReadEnv): boolean {
  return (read("STRIPE_MODE") ?? "").trim() === "live";
}

/** The secret key for the active universe, or null. STRIPE_MODE other than
 *  exactly `live` is test; live without STRIPE_ALLOW_LIVE=true is refused,
 *  and a mode never falls through to the other mode's key. */
export function boostStripeKey(read: ReadEnv = envRead): string | null {
  const live = stripeLive(read);
  if (live && (read("STRIPE_ALLOW_LIVE") ?? "").trim() !== "true") return null;
  const key = (read(live ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST") ?? "").trim();
  return key === "" ? null : key;
}

/** True when the key in use is the live one (a test customer does not exist
 *  in live mode, so customers are stored per mode). */
export function boostLivemode(read: ReadEnv = envRead): boolean {
  return stripeLive(read) && (read("STRIPE_ALLOW_LIVE") ?? "").trim() === "true";
}

/** Stripe's form encoding: nested keys as a[b][c], arrays as a[0][b]. */
export function stripeForm(params: Record<string, unknown>): string {
  const out = new URLSearchParams();
  const walk = (prefix: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(`${prefix}[${i}]`, item));
    } else if (typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        walk(prefix ? `${prefix}[${k}]` : k, child);
      }
    } else {
      out.append(prefix, String(v));
    }
  };
  walk("", params);
  return out.toString();
}

/** A Stripe API error with its type and code (card_error, idempotency_error…). */
export class StripeError extends Error {
  constructor(
    readonly path: string,
    readonly type: string,
    readonly code: string,
    readonly httpStatus: number,
    message: string,
  ) {
    super(`stripe ${path}: ${message}`);
  }
}

export type StripeCall = (
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, unknown>,
  opts?: { idempotencyKey?: string },
) => Promise<Record<string, unknown>>;

export function stripeClient(key: string, fetchFn: typeof fetch = fetch): StripeCall {
  return async (method, path, params, opts) => {
    const body = params ? stripeForm(params) : "";
    const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (opts?.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    const res = await fetchFn(url, { method, headers, body: method === "GET" ? undefined : body });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (data.error ?? {}) as { message?: string; type?: string; code?: string };
      throw new StripeError(path, err.type ?? "", err.code ?? "", res.status, err.message ?? String(res.status));
    }
    return data;
  };
}

/** The Checkout that saves a guest's card for a pledge. `payment` charges the
 *  quoted amount, held (manual capture) until the quote is confirmed;
 *  `setup` only saves the card. Metadata carries the quote the server made,
 *  so confirm never trusts the browser. */
export function pledgeCheckoutParams(args: {
  kind: "payment" | "setup";
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
    price_cents: String(boostAmountCents(args.tier, args.interval)),
    credit_cents: String(args.quote.credit_cents),
    extra_days: String(args.quote.extra_days),
    charge_cents: String(args.quote.charge_cents),
    role: args.quote.role,
  };
  const common = {
    customer: args.customer,
    client_reference_id: args.backingId,
    success_url: `${args.returnUrl}${sep}boost={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + CHECKOUT_TTL_SEC,
    metadata,
  };
  if (args.kind === "setup") {
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
        product_data: { name: `${PREMIER_LABEL[args.tier]} · ${args.placeName}`.slice(0, 250) },
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

function idOf(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return null;
}

// ── Writes ────────────────────────────────────────────────────────────────

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

/** A pledge's Checkout came back paid or saved: its card is kept, pending
 *  terms move in, and it stands in line (queued now unless it already was). */
async function readyPledge(admin: SupabaseClient, pledge: Pledge, paymentMethod: string | null): Promise<void> {
  const patch: Record<string, unknown> = {
    status: "ready",
    stripe_payment_method_id: paymentMethod ?? pledge.stripe_payment_method_id,
    pending_tier: null,
    pending_interval: null,
    pending_amount_cents: null,
    quoted_period_id: null,
    quoted_credit_cents: 0,
  };
  if (pledge.pending_tier) {
    patch.tier = pledge.pending_tier;
    patch.billing_interval = pledge.pending_interval ?? pledge.billing_interval;
    patch.amount_cents = pledge.pending_amount_cents ?? pledge.amount_cents;
  }
  if (pledge.status !== "ready") patch.queued_at = new Date().toISOString();
  const err = await updatePledge(admin, pledge.id, patch);
  if (err) throw new Error(`pledge_ready: ${err}`);
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

async function settle(
  admin: SupabaseClient,
  periodId: string,
  outcome: "paid" | "declined",
  paymentIntentId: string | null,
): Promise<string> {
  const { data, error } = await admin.rpc("premier_settle", {
    p_period_id: periodId,
    p_outcome: outcome,
    p_payment_intent_id: paymentIntentId,
  });
  if (error) throw new Error(`premier_settle: ${error.message}`);
  return String(data);
}

/** Capture a held upgrade payment for a period already claimed, then settle
 *  it. A capture Stripe refuses settles declined (the cut period gets its
 *  end back); an unknown answer leaves it charging for the cron. */
async function captureClaim(
  admin: SupabaseClient,
  stripe: StripeCall,
  periodId: string,
  pi: Record<string, unknown>,
): Promise<"paid" | "declined" | "unknown"> {
  const piId = idOf(pi)!;
  if (pi.status === "succeeded") {
    await settle(admin, periodId, "paid", piId);
    return "paid";
  }
  try {
    const captured = await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/capture`, undefined, {
      idempotencyKey: captureKey(piId),
    });
    if (captured.status === "succeeded") {
      await settle(admin, periodId, "paid", piId);
      return "paid";
    }
  } catch (err) {
    if (err instanceof StripeError && err.httpStatus >= 400 && err.httpStatus < 500) {
      console.error("[premier] capture_refused", JSON.stringify({ period_id: periodId, pi: piId, error: err.message }));
      await settle(admin, periodId, "declined", piId);
      return "declined";
    }
    console.error("[premier] capture_unknown", JSON.stringify({ period_id: periodId, pi: piId, error: errorMessage(err) }));
  }
  return "unknown";
}

export type ConfirmOutcome = "confirmed" | "saved_as_backup" | "released_stale" | "pending" | "expired" | "none";

/** Checkout's return and the cron settle a pledge's Checkout here, and only
 *  here. Bound to the pledge's own stored session, whose metadata must name
 *  this pledge. Pays-now: claim under the place lock, then capture; a quote
 *  that no longer holds releases the hold and keeps the card as a backup.
 *  Setup: the card is saved (and a covered upgrade is claimed). Idempotent. */
export async function confirmPledge(
  admin: SupabaseClient,
  stripe: StripeCall,
  pledge: Pledge,
  livemode: boolean,
): Promise<ConfirmOutcome> {
  const sessionId = pledge.stripe_checkout_session_id;
  if (!sessionId) return "none";
  const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`, {
    expand: ["payment_intent", "setup_intent"],
  });
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.backing_id !== pledge.id) {
    console.error("[premier] session_mismatch", JSON.stringify({ backing_id: pledge.id, session_id: sessionId }));
    return "none";
  }
  if (session.status === "open") return "pending";
  if (session.status === "expired") {
    const err = pledge.status === "open"
      ? await updatePledge(admin, pledge.id, { status: "ended", ended_at: new Date().toISOString(), stripe_checkout_session_id: null })
      : await updatePledge(admin, pledge.id, {
        stripe_checkout_session_id: null,
        pending_tier: null,
        pending_interval: null,
        pending_amount_cents: null,
        quoted_period_id: null,
        quoted_credit_cents: 0,
      });
    if (err) throw new Error(`pledge_expire: ${err}`);
    return "expired";
  }

  if (session.mode === "payment") {
    const pi = session.payment_intent as Record<string, unknown> | null;
    const piId = idOf(pi);
    if (!pi || !piId) return "pending";
    if (pi.status === "canceled") {
      await readyPledge(admin, { ...pledge, pending_tier: pledge.pending_tier }, idOf(pi.payment_method));
      return "released_stale";
    }
    if (pi.status !== "requires_capture" && pi.status !== "succeeded") return "pending";
    const claimed = await claim(admin, pledge, meta, { paymentIntentId: piId, sessionId, status: "charging", livemode });
    if (claimed.result === "stale") {
      if (pi.status === "requires_capture") {
        await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/cancel`, undefined, {
          idempotencyKey: `premier-release:${piId}`,
        });
      } else {
        // Captured already and stale: cannot happen under the lock. Refund it.
        await stripe("POST", "refunds", { payment_intent: piId }, { idempotencyKey: `premier-refund:${piId}` });
        console.error("[premier] refund_after_capture", JSON.stringify({ backing_id: pledge.id, pi: piId }));
      }
      await readyPledge(admin, pledge, idOf(pi.payment_method));
      return "released_stale";
    }
    if (claimed.result === "missing" || !claimed.period_id) return "none";
    const outcome = await captureClaim(admin, stripe, claimed.period_id, pi);
    if (outcome === "declined") return "released_stale";
    await readyPledge(admin, pledge, idOf(pi.payment_method));
    return outcome === "paid" ? "confirmed" : "pending";
  }

  // Setup: the card is saved.
  const si = session.setup_intent as Record<string, unknown> | null;
  const pm = idOf(si?.payment_method);
  if (!pm) return "pending";
  if (meta.role === "payer") {
    const claimed = await claim(admin, pledge, meta, { paymentIntentId: null, sessionId, status: "paid", livemode });
    await readyPledge(admin, pledge, pm);
    return claimed.result === "started" || claimed.result === "settled" ? "confirmed" : "saved_as_backup";
  }
  await readyPledge(admin, pledge, pm);
  return "saved_as_backup";
}

/** An upgrade covered by credit for a guest whose card is already saved:
 *  no Checkout, claimed straight away. */
export async function claimWithoutCheckout(
  admin: SupabaseClient,
  pledge: Pledge,
  tier: BoostTier,
  interval: BoostInterval,
  q: Quote,
  quotedPeriodId: string | null,
  livemode: boolean,
): Promise<ConfirmOutcome> {
  const { data, error } = await admin.rpc("premier_claim", {
    p_backing_id: pledge.id,
    p_quoted_period_id: quotedPeriodId,
    p_tier: tier,
    p_interval: interval,
    p_price_cents: boostAmountCents(tier, interval),
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
  if (claimed.result !== "started") return "released_stale";
  const err = await updatePledge(admin, pledge.id, {
    tier,
    billing_interval: interval,
    amount_cents: boostAmountCents(tier, interval),
    quoted_period_id: null,
    quoted_credit_cents: 0,
  });
  if (err) throw new Error(`pledge_update: ${err}`);
  return "confirmed";
}

/** Settle a charge in flight. An upgrade's held payment is captured; a
 *  renewal's is re-asked with the same key; past 24 h a payment Stripe still
 *  has not finished is cancelled and declined. */
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
      await settle(admin, period.id, "paid", period.stripe_payment_intent_id);
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
    await settle(admin, period.id, "declined", period.stripe_payment_intent_id);
    return "declined";
  }
  return await attemptRenewalCharge(admin, stripe, period, now);
}

/** One renewal charge for a `charging` row the RPC opened. */
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
    await settle(admin, period.id, "declined", null);
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
        label: `${PREMIER_LABEL[TIER_BY_RANK[period.tier as TierRank] ?? "boost_2x"]} renewal`,
      }),
      { idempotencyKey: chargeKey(period.id) },
    );
  } catch (err) {
    error = err;
  }
  const outcome = chargeOutcome({ pi, error });
  const piId = idOf(pi) ?? idOf((error as { payment_intent?: unknown } | undefined)?.payment_intent);
  if (outcome === "paid" || outcome === "declined") {
    await settle(admin, period.id, outcome, piId);
    return outcome;
  }
  if (now - Date.parse(period.created_at) >= CHARGING_GIVE_UP_MS) {
    console.error("[premier] charge_give_up", JSON.stringify({ period_id: period.id, error: errorMessage(error) }));
    await settle(admin, period.id, "declined", piId);
    return "declined";
  }
  console.error("[premier] charge_unknown", JSON.stringify({ period_id: period.id, error: error ? errorMessage(error) : String(pi?.status) }));
  return "unknown";
}

/** Renew one place: walk the line top-down until a pledge pays, the line
 *  runs dry, or an answer is not known yet (then the next run asks again).
 *  Never charges a second pledge while a charge is in flight. */
export async function renewPlace(
  admin: SupabaseClient,
  stripe: StripeCall,
  placeId: string,
  now = Date.now(),
): Promise<"idle" | "paid" | "dry" | "unknown"> {
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.rpc("premier_begin_renewal", { p_place_id: placeId });
    if (error) throw new Error(`premier_begin_renewal: ${error.message}`);
    const step = data as { action: "none" | "resolve" | "charge"; period_id?: string };
    if (step.action === "none") return i === 0 ? "idle" : "dry";
    const period = await readPeriod(admin, step.period_id!);
    if (!period) return "unknown";
    const outcome = await settleCharging(admin, stripe, period, now);
    if (outcome === "paid") return "paid";
    if (outcome === "unknown") return "unknown";
  }
  return "unknown";
}

/** A guest leaves a place's line: a backup goes at once; a payer keeps the
 *  period they paid for and the next renewal walks the rest of the line.
 *  Their saved card is detached; an open Checkout is expired. */
export async function leavePledge(admin: SupabaseClient, stripe: StripeCall | null, pledge: Pledge): Promise<void> {
  if (pledge.stripe_checkout_session_id && stripe) {
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(pledge.stripe_checkout_session_id)}/expire`);
    } catch (err) {
      // Already complete or expired: nothing payable is left open.
      console.error("[premier] leave_expire", pledge.id, errorMessage(err));
    }
  }
  if (pledge.stripe_payment_method_id && stripe) {
    try {
      await stripe("POST", `payment_methods/${encodeURIComponent(pledge.stripe_payment_method_id)}/detach`);
    } catch (err) {
      if (!(err instanceof StripeError && (err.code === "resource_missing" || err.httpStatus === 400))) throw err;
    }
  }
  const err = await updatePledge(admin, pledge.id, {
    status: "ended",
    ended_at: new Date().toISOString(),
    stripe_checkout_session_id: null,
    pending_tier: null,
    pending_interval: null,
    pending_amount_cents: null,
  });
  if (err) throw new Error(`pledge_leave: ${err}`);
}

/** Account deletion (consumer-web-delete-account): every charge in flight on
 *  the guest's pledges is settled first (a charge still unknown refuses the
 *  deletion; it is asked again), then every pledge leaves its line. */
export async function endConsumerPledges(
  admin: SupabaseClient,
  consumerId: string,
  stripe: StripeCall | null,
): Promise<{ ok: true; ended: number } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("place_backings")
    .select(PLEDGE_COLUMNS)
    .eq("consumer_id", consumerId)
    .in("status", ["open", "ready", "failed"]);
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
    for (const pledge of pledges) await leavePledge(admin, stripe, pledge);
  } catch (err) {
    return { ok: false, error: `premier_end: ${errorMessage(err)}` };
  }
  return { ok: true, ended: pledges.length };
}

// ── Reads (last in the file: the write-surface scans look 2000 characters
// past a doored table's .from(), and nothing below writes) ─────────────────

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

async function readCustomer(admin: SupabaseClient, consumerId: string, livemode: boolean): Promise<string | null> {
  const { data, error } = await admin
    .from("premier_customers")
    .select("stripe_customer")
    .eq("consumer_id", consumerId)
    .eq("livemode", livemode)
    .maybeSingle();
  if (error) throw new Error(`customer_read: ${error.message}`);
  return (data as { stripe_customer: string } | null)?.stripe_customer ?? null;
}

async function readAuthEmail(admin: SupabaseClient, consumerId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(consumerId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** A place's line and its recent periods (what get-boost, start-boost and
 *  the admin read). */
export async function readLine(
  admin: SupabaseClient,
  placeId: string,
  opts: { periodsSince?: number; allPledges?: boolean } = {},
): Promise<{ ok: true; pledges: Pledge[]; periods: Period[] } | { ok: false; error: string }> {
  const since = new Date(opts.periodsSince ?? Date.now() - 2 * 3600_000).toISOString();
  let pledgeQuery = admin.from("place_backings").select(PLEDGE_COLUMNS).eq("place_id", placeId);
  if (!opts.allPledges) pledgeQuery = pledgeQuery.in("status", ["open", "ready", "failed"]);
  const [pRes, perRes] = await Promise.all([
    pledgeQuery.order("created_at", { ascending: true }),
    admin
      .from("place_premier_periods")
      .select(PERIOD_COLUMNS)
      .eq("place_id", placeId)
      .gte("ends_at", since)
      .order("starts_at", { ascending: false })
      .limit(50),
  ]);
  if (pRes.error) return { ok: false, error: `pledges_read: ${pRes.error.message}` };
  if (perRes.error) return { ok: false, error: `periods_read: ${perRes.error.message}` };
  return { ok: true, pledges: (pRes.data ?? []) as Pledge[], periods: (perRes.data ?? []) as Period[] };
}

/** The place a pledge is for, through the browse view: name, state and
 *  its current tier. */
export async function readBoostPlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<
  | { ok: true; place: { id: string; name: string | null; state: string | null; boost_tier: number } | null }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, state, boost_tier")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return { ok: false, error: `place_read: ${error.message}` };
  return { ok: true, place: data ?? null };
}

/** First names of the given payers, in order: the admin console only, never a
 *  guest (MESITA-2928). */
export async function readBackerNames(
  admin: SupabaseClient,
  consumerIds: string[],
  fallback: string,
): Promise<string[]> {
  if (consumerIds.length === 0) return [];
  const { data, error } = await admin
    .from("consumers")
    .select("id, first_name")
    .in("id", consumerIds);
  if (error) {
    console.error("[boost] backer names:", error.message);
    return [];
  }
  const byId = new Map(
    (data ?? []).map((p: { id: string; first_name: string | null }) => [p.id, p.first_name?.trim() || fallback]),
  );
  return consumerIds.map((id) => byId.get(id) ?? fallback);
}

// Boost (MESITA-2789, was Spotlight MESITA-1998): anyone can pay a monthly
// or yearly tier for a place from the consumer app, and many guests may
// back one place, each with their own Stripe subscription. `place_backings`
// mirrors those subscriptions; its trigger derives `places.boost_tier` from
// the live ones (migration 20261027000000). Paid, never verified, never
// Selected, and marked Sponsored wherever a guest sees it.
//
// Stripe is reached over its REST API with fetch (no SDK): four calls, all
// form-encoded. The key follows STRIPE_MODE, which defaults to TEST; live
// also needs STRIPE_ALLOW_LIVE=true, and only Pato sets either.
//
// decision: prices are fixed here, not a console knob — a price is a money
// promise to the guests already paying it, so it changes by PR.
// decision (Pato, MESITA-2789): a yearly plan costs ten months for twelve,
// so toward the place's tier it counts a TENTH a month — a $100/yr backing
// buys Boost 2x exactly like $10/mo.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type BoostTier = "boost_2x" | "boost_5x" | "boost_10x";
export type BoostInterval = "month" | "year";

export const BOOST_TIERS = ["boost_2x", "boost_5x", "boost_10x"] as const satisfies readonly BoostTier[];

/** Monthly price in US cents. The SQL trigger's thresholds are these three
 *  numbers (recompute_place_boost); change both together. */
export const BOOST_MONTHLY_CENTS: Record<BoostTier, number> = {
  boost_2x: 1000,
  boost_5x: 5000,
  boost_10x: 20000,
};

/** A year is billed as this many months. */
export const BOOST_YEAR_MONTHS = 10;

export const BOOST_CURRENCY = "usd";

export const BOOST_LABEL: Record<BoostTier, string> = {
  boost_2x: "Boost 2x",
  boost_5x: "Boost 5x",
  boost_10x: "Boost 10x",
};

/** The Area score multiplier a place's `boost_tier` (0..3) earns. Literal:
 *  the tier names promise the number. */
export const BOOST_FACTOR: Record<0 | 1 | 2 | 3, number> = { 0: 1, 1: 2, 2: 5, 3: 10 };

/** What the guest pays per interval. */
export function boostAmountCents(tier: BoostTier, interval: BoostInterval): number {
  const monthly = BOOST_MONTHLY_CENTS[tier];
  return interval === "year" ? monthly * BOOST_YEAR_MONTHS : monthly;
}

/** What one backing counts toward its place's tier, per month. */
export function monthlyEquivalentCents(amountCents: number, interval: BoostInterval): number {
  return interval === "year" ? amountCents / BOOST_YEAR_MONTHS : amountCents;
}

/** The place's tier from its live backings' monthly-equivalent total — the
 *  same rule the SQL trigger runs, kept here for the wire and its test. */
export function tierFromMonthlyCents(cents: number): 0 | 1 | 2 | 3 {
  if (cents >= BOOST_MONTHLY_CENTS.boost_10x) return 3;
  if (cents >= BOOST_MONTHLY_CENTS.boost_5x) return 2;
  if (cents >= BOOST_MONTHLY_CENTS.boost_2x) return 1;
  return 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BoostStart = {
  placeId: string;
  tier: BoostTier;
  interval: BoostInterval;
  showName: boolean;
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
  if (typeof placeId !== "string" || !UUID_RE.test(placeId)) {
    return { ok: false, error: "place_id must be a Mesita place id" };
  }
  const tier = body.tier;
  if (typeof tier !== "string" || !(BOOST_TIERS as readonly string[]).includes(tier)) {
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
  return {
    ok: true,
    start: { placeId, tier: tier as BoostTier, interval, showName: body.show_name === true, returnUrl },
  };
}

// ── Stripe ────────────────────────────────────────────────────────────────

type ReadEnv = (name: string) => string | undefined;
const envRead: ReadEnv = (name) => Deno.env.get(name);

/** The secret key for the active universe, or null. STRIPE_MODE other than
 *  exactly `live` is test; live without STRIPE_ALLOW_LIVE=true is refused,
 *  and a mode never falls through to the other mode's key. */
export function boostStripeKey(read: ReadEnv = envRead): string | null {
  const mode = (read("STRIPE_MODE") ?? "").trim() === "live" ? "live" : "test";
  if (mode === "live" && (read("STRIPE_ALLOW_LIVE") ?? "").trim() !== "true") return null;
  const key = (read(mode === "live" ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST") ?? "").trim();
  return key === "" ? null : key;
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

export type StripeCall = (
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export function stripeClient(key: string, fetchFn: typeof fetch = fetch): StripeCall {
  return async (method, path, params) => {
    const body = params ? stripeForm(params) : "";
    const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
    const res = await fetchFn(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: method === "GET" ? undefined : body,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = data.error as { message?: string } | undefined;
      throw new Error(`stripe ${path}: ${err?.message ?? res.status}`);
    }
    return data;
  };
}

/** The Checkout Session that opens one guest's backing. Prices are inline
 *  (price_data), so no product has to exist in the dashboard first. */
export function checkoutParams(
  start: BoostStart,
  ctx: { backingId: string; consumerId: string; placeName: string },
): Record<string, unknown> {
  const sep = start.returnUrl.includes("?") ? "&" : "?";
  const metadata = {
    mesita_kind: "boost",
    backing_id: ctx.backingId,
    place_id: start.placeId,
    consumer_id: ctx.consumerId,
    tier: start.tier,
  };
  return {
    mode: "subscription",
    client_reference_id: ctx.backingId,
    success_url: `${start.returnUrl}${sep}boost={CHECKOUT_SESSION_ID}`,
    cancel_url: start.returnUrl,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: BOOST_CURRENCY,
        unit_amount: boostAmountCents(start.tier, start.interval),
        recurring: { interval: start.interval },
        product_data: { name: `${BOOST_LABEL[start.tier]} · ${ctx.placeName}`.slice(0, 250) },
      },
    }],
    metadata,
    subscription_data: { metadata },
  };
}

/** The columns a Stripe subscription sets on its backing row. Since API
 *  2025-03-31 the period lives on the item; older shapes keep it on top. */
export function subscriptionPatch(sub: Record<string, unknown>): Record<string, unknown> {
  const items = (sub.items as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
  const end = numOr(sub.current_period_end) ?? numOr(items[0]?.current_period_end);
  const customer = typeof sub.customer === "string"
    ? sub.customer
    : (sub.customer as { id?: string } | null)?.id ?? null;
  return {
    stripe_subscription_id: typeof sub.id === "string" ? sub.id : null,
    stripe_customer_id: customer,
    status: typeof sub.status === "string" ? sub.status : "incomplete",
    current_period_end: end != null ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end === true,
    livemode: sub.livemode === true,
    updated_at: new Date().toISOString(),
  };
}

function numOr(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A backing that still pays: what the SQL trigger counts. */
export function isLiveBacking(
  row: { status?: unknown; current_period_end?: unknown },
  now = Date.now(),
): boolean {
  if (row.status !== "active" && row.status !== "trialing") return false;
  const end = typeof row.current_period_end === "string" ? Date.parse(row.current_period_end) : NaN;
  return Number.isFinite(end) && end > now;
}

/** Account deletion (consumer-web-delete-account): end every subscription
 *  the guest still pays, at once, so nobody is billed for an account that
 *  no longer exists. A Stripe failure refuses the deletion. */
export async function cancelConsumerBackings(
  admin: SupabaseClient,
  consumerId: string,
  stripe: StripeCall | null,
): Promise<{ ok: true; cancelled: number } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("place_backings")
    .select("id, stripe_subscription_id, status")
    .eq("consumer_id", consumerId)
    .not("stripe_subscription_id", "is", null)
    .in("status", ["active", "trialing", "past_due", "incomplete", "unpaid"]);
  if (error) return { ok: false, error: `backings_read: ${error.message}` };
  const rows = (data ?? []) as Array<{ id: string; stripe_subscription_id: string }>;
  if (rows.length === 0) return { ok: true, cancelled: 0 };
  if (!stripe) return { ok: false, error: "boost_cancel: payments unavailable" };
  for (const row of rows) {
    try {
      const sub = await stripe("DELETE", `subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`);
      await admin.from("place_backings").update(subscriptionPatch(sub)).eq("id", row.id);
    } catch (err) {
      return { ok: false, error: `boost_cancel: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  return { ok: true, cancelled: rows.length };
}

// ── Reads (last in the file: the write-surface scans look 2000 characters
// past a doored table's .from(), and nothing below writes) ─────────────────

/** The place a backing is for, through the browse view: name, state and
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

/** First names of the backers who chose to be shown, in the given order. */
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

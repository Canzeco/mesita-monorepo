// Premier (MESITA-2925; Boost since MESITA-2789, Spotlight MESITA-1998
// before it; code names keep `boost`): anyone can pay a monthly
// or yearly tier for a place from the consumer app, and many guests may
// back one place, each with their own Stripe subscription. `place_backings`
// mirrors those subscriptions; its trigger derives `places.boost_tier` from
// the live ones (migration 20261027000000). Paid, never verified, and
// marked Premier 2X · 5X · 10X wherever a guest sees it.
//
// Stripe is reached over its REST API with fetch (no SDK): four calls, all
// form-encoded. The key follows STRIPE_MODE, which defaults to TEST; live
// also needs STRIPE_ALLOW_LIVE=true, and only Pato sets either.
//
// decision: prices are fixed here, not a console knob — a price is a money
// promise to the guests already paying it, so it changes by PR.
// decision (Pato, MESITA-2789): a yearly plan costs ten months for twelve,
// so toward the place's tier it counts a TENTH a month — a $100/yr backing
// buys Premier 2X exactly like $10/mo.

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

/** The Stripe product line's name (MESITA-2925). The wire tiers keep their
 *  stored `boost_*` keys. */
export const BOOST_LABEL: Record<BoostTier, string> = {
  boost_2x: "Premier 2X",
  boost_5x: "Premier 5X",
  boost_10x: "Premier 10X",
};

/** The Premier factor a place's `boost_tier` (0..3) earns in the Area
 *  score. Literal: the tier names promise the number. */
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
    start: { placeId, tier: tier as BoostTier, interval, returnUrl },
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
 *  no longer exists. A Stripe failure refuses the deletion.
 *
 *  A DELETE that throws is checked against Stripe (MESITA-2855): a
 *  subscription already `canceled` or `incomplete_expired` there is done, so
 *  its row is patched and counted instead of refusing the deletion forever.
 *  A failed row write refuses the deletion too. The loop stops at the first
 *  failure; rows already patched leave the live-status filter, so the retry
 *  resumes where this run stopped. */
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
    const path = `subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`;
    let sub: Record<string, unknown>;
    try {
      sub = await stripe("DELETE", path);
    } catch (err) {
      const deleteError = errorText(err);
      try {
        sub = await stripe("GET", path);
      } catch (getErr) {
        return { ok: false, error: `boost_cancel: ${deleteError} (lookup: ${errorText(getErr)})` };
      }
      if (!STRIPE_ENDED.has(String(sub.status))) {
        return { ok: false, error: `boost_cancel: ${deleteError} (still ${String(sub.status)})` };
      }
    }
    const { error: updErr } = await admin
      .from("place_backings")
      .update(subscriptionPatch(sub))
      .eq("id", row.id);
    if (updErr) return { ok: false, error: `boost_cancel: backings_update: ${updErr.message}` };
  }
  return { ok: true, cancelled: rows.length };
}

/** Stripe subscription statuses that never bill again. */
const STRIPE_ENDED = new Set(["canceled", "incomplete_expired"]);

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type BoostReply = { status: number; body: Record<string, unknown> };

/** consumer-web-start-boost, after its `open` row is inserted: opens the
 *  Checkout Session and records its id on the row.
 *
 *  consumer-web-get-boost finds the backing by that session id when Stripe
 *  sends the guest back, so a row without it is a payment nobody can confirm
 *  (MESITA-2855). The write is retried once, then re-read (a timed-out write
 *  may have landed). If it truly failed, the session is expired and the row
 *  deleted, and the reply never carries the Checkout url, so the guest has
 *  nothing to pay. A failed expire or delete is logged; the hourly sync drops
 *  `open` rows after 24 h. */
export async function openBackingCheckout(
  admin: SupabaseClient,
  stripe: StripeCall,
  start: BoostStart,
  ctx: { backingId: string; consumerId: string; placeName: string },
): Promise<BoostReply> {
  const failed: BoostReply = { status: 502, body: { ok: false, error: "Couldn't open checkout. Try again." } };
  let session: Record<string, unknown>;
  try {
    session = await stripe("POST", "checkout/sessions", checkoutParams(start, ctx));
  } catch (err) {
    console.error("[consumer-web-start-boost] checkout:", errorText(err));
    await deleteOpenBacking(admin, ctx.backingId, null);
    return failed;
  }
  const sessionId = String(session.id ?? "");
  const patch = { stripe_checkout_session_id: sessionId, livemode: session.livemode === true };
  const opened: BoostReply = { status: 200, body: { ok: true, url: session.url } };
  for (let attempt = 0; attempt < 2; attempt++) {
    const err = await updateBacking(admin, ctx.backingId, patch);
    if (!err) return opened;
    console.error(`[consumer-web-start-boost] session_write attempt ${attempt + 1}:`, err);
  }
  const { data: back, error: readErr } = await admin
    .from("place_backings")
    .select("stripe_checkout_session_id")
    .eq("id", ctx.backingId)
    .maybeSingle();
  if (!readErr && sessionId && back?.stripe_checkout_session_id === sessionId) return opened;
  try {
    await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
  } catch (err) {
    console.error(
      "[consumer-web-start-boost] expire_failed",
      JSON.stringify({ backing_id: ctx.backingId, session_id: sessionId, error: errorText(err) }),
    );
  }
  await deleteOpenBacking(admin, ctx.backingId, sessionId);
  return failed;
}

/** consumer-web-cancel-boost: stop renewing one backing at period end. A
 *  row write that fails after Stripe agreed answers 500 so the guest retries
 *  (the Stripe call is idempotent); supabase-cron-sync-boosts re-syncs the
 *  row near the period end either way (MESITA-2855). */
export async function cancelBackingAtPeriodEnd(
  admin: SupabaseClient,
  stripe: StripeCall,
  row: { id: string; stripe_subscription_id: string },
): Promise<BoostReply> {
  let sub: Record<string, unknown>;
  try {
    sub = await stripe(
      "POST",
      `subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`,
      { cancel_at_period_end: true },
    );
  } catch (err) {
    console.error("[consumer-web-cancel-boost] stripe:", errorText(err));
    return { status: 502, body: { ok: false, error: "Couldn't cancel. Try again." } };
  }
  const patch = subscriptionPatch(sub);
  const err = await updateBacking(admin, row.id, patch);
  if (err) {
    console.error("[consumer-web-cancel-boost] backings_update:", err);
    return { status: 500, body: { ok: false, error: "Couldn't cancel. Try again." } };
  }
  return { status: 200, body: { ok: true, current_period_end: patch.current_period_end } };
}

/** Checkout's return and the hourly sync both confirm a backing from its
 *  Checkout Session: the subscription Stripe opened for it is written onto
 *  the row. "unpaid" when the session holds no subscription yet; the
 *  session itself rides along so the sync can decide what to do next.
 *  A Stripe or row-write failure throws. */
export async function confirmBackingFromSession(
  admin: SupabaseClient,
  stripe: StripeCall,
  backingId: string,
  sessionId: string,
): Promise<{ confirmed: boolean; session: Record<string, unknown> }> {
  const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`, {
    expand: ["subscription"],
  });
  const sub = session.subscription as Record<string, unknown> | string | null | undefined;
  if (!sub || typeof sub !== "object") return { confirmed: false, session };
  const err = await updateBacking(admin, backingId, subscriptionPatch(sub));
  if (err) throw new BackingWriteError(err);
  return { confirmed: true, session };
}

/** Stripe answered and the row write failed: never a reason to give up. */
export class BackingWriteError extends Error {
  constructor(detail: string) {
    super(`backings_update: ${detail}`);
  }
}

/** What the hourly sync does with an `open` backing older than a day
 *  (MESITA-2857): a guest who paid and closed the tab must keep the backing
 *  Stripe bills them for, so the row is only dropped once Stripe says the
 *  Checkout can no longer be paid.
 *  - confirm: the session holds a subscription (written by the caller).
 *  - expire: still payable; expire it at Stripe first, then drop the row.
 *  - drop: expired at Stripe, nothing was paid.
 *  - keep: completed without a subscription, or a status we do not know;
 *    ask again next hour. */
export type StaleCheckoutVerdict = "confirm" | "expire" | "drop" | "keep";

export function staleCheckoutVerdict(session: Record<string, unknown>): StaleCheckoutVerdict {
  const sub = session.subscription;
  if (sub && (typeof sub === "object" || typeof sub === "string")) return "confirm";
  if (session.status === "expired") return "drop";
  if (session.status === "open") return "expire";
  return "keep";
}

/** A stale row whose session Stripe will not answer for this long is
 *  dropped anyway (a session from the other Stripe mode never resolves). */
export const STALE_LOOKUP_GIVE_UP_MS = 7 * 24 * 3600_000;

export type StaleOutcome = "confirmed" | "dropped" | "kept";

/** supabase-cron-sync-boosts: settle one `open` row older than a day.
 *  A row that never reached Checkout (no session id) is dropped. Never
 *  throws; a failure keeps the row for the next run. */
export async function reconcileStaleBacking(
  admin: SupabaseClient,
  stripe: StripeCall | null,
  row: { id: string; stripe_checkout_session_id: string | null; created_at: string },
  now = Date.now(),
): Promise<StaleOutcome> {
  const sessionId = row.stripe_checkout_session_id;
  if (!sessionId) return (await dropOpenBacking(admin, row.id)) ? "dropped" : "kept";
  if (!stripe) return "kept";
  let verdict: StaleCheckoutVerdict;
  try {
    const { confirmed, session } = await confirmBackingFromSession(admin, stripe, row.id, sessionId);
    if (confirmed) return "confirmed";
    verdict = staleCheckoutVerdict(session);
    // A subscription id that did not expand is not a confirmation: retry.
    if (verdict === "confirm") verdict = "keep";
  } catch (err) {
    const age = now - Date.parse(row.created_at);
    if (!(err instanceof BackingWriteError) && Number.isFinite(age) && age > STALE_LOOKUP_GIVE_UP_MS) {
      console.error(
        "[supabase-cron-sync-boosts] give_up",
        JSON.stringify({ backing_id: row.id, session_id: sessionId, error: errorText(err) }),
      );
      return (await dropOpenBacking(admin, row.id)) ? "dropped" : "kept";
    }
    console.error("[supabase-cron-sync-boosts] lookup", row.id, errorText(err));
    return "kept";
  }
  if (verdict === "keep") return "kept";
  if (verdict === "expire") {
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    } catch (err) {
      console.error("[supabase-cron-sync-boosts] expire", row.id, errorText(err));
      return "kept";
    }
  }
  return (await dropOpenBacking(admin, row.id)) ? "dropped" : "kept";
}

/** Deletes a row only while it is still `open`: a guest confirming at the
 *  same moment wins. */
async function dropOpenBacking(admin: SupabaseClient, backingId: string): Promise<boolean> {
  try {
    const { error } = await admin.from("place_backings").delete().eq("id", backingId).eq("status", "open");
    if (!error) return true;
    console.error("[supabase-cron-sync-boosts] drop", backingId, error.message);
  } catch (err) {
    console.error("[supabase-cron-sync-boosts] drop", backingId, errorText(err));
  }
  return false;
}

/** One backing row write; the error text, or null when it landed. */
async function updateBacking(
  admin: SupabaseClient,
  backingId: string,
  patch: Record<string, unknown>,
): Promise<string | null> {
  try {
    const { error } = await admin.from("place_backings").update(patch).eq("id", backingId);
    return error ? error.message : null;
  } catch (err) {
    return errorText(err);
  }
}

async function deleteOpenBacking(
  admin: SupabaseClient,
  backingId: string,
  sessionId: string | null,
): Promise<void> {
  try {
    const { error } = await admin.from("place_backings").delete().eq("id", backingId);
    if (!error) return;
    console.error(
      "[consumer-web-start-boost] delete_failed",
      JSON.stringify({ backing_id: backingId, session_id: sessionId, error: error.message }),
    );
  } catch (err) {
    console.error(
      "[consumer-web-start-boost] delete_failed",
      JSON.stringify({ backing_id: backingId, session_id: sessionId, error: errorText(err) }),
    );
  }
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

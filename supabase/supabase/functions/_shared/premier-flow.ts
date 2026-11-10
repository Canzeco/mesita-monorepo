// Premier Subscription, the flows behind its doors (MESITA-3103):
// business-web-{get,start,cancel}-premier, web-business. The bodies were the
// consumer EFs'; the guest's doors retired with MESITA-3168 (a guest buys
// Refill days instead, _shared/premier-purchase.ts). Each returns the
// Response its EF sends.
//
// The place adds one thing the guest cannot do: whoever runs the place may
// stop a subscription a guest pays (`stopPremierAsPlace`, ended reason
// `stopped_by_place`, reserved since MESITA-3092). The paid period runs out;
// nothing renews it; the payer's card is detached.

import { json } from "./http.ts";
import { isUuid } from "./place-id.ts";
import { adminClient, type EFEnv } from "./auth.ts";
import { loadPremierPrices } from "./discovery-config.ts";
import {
  boostAmountCents,
  canResume,
  chargingPeriod,
  type CheckoutKind,
  type EndedReason,
  type Period,
  type Pledge,
  PLEDGE_COLUMNS,
  pledgeCheckoutParams,
  PREMIER_CURRENCY,
  quote,
  type Quote,
  quotes,
  readBoostPlace,
  readLine,
  readPledge,
  runningManual,
  runningPeriod,
  subscriptionOf,
  TIER_RANK,
  viewerOf,
  type BoostStart,
} from "./boost.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "./stripe.ts";
import { claimWithoutCheckout, type ConfirmOutcome, confirmPledge, ensureCustomer, leavePledge } from "./boost-writes.ts";

const refuse = (code: string, error: string) => json({ ok: false, code, error });

/** Reasons the former payer is told about, for 30 days (E2). */
const NOTICE_REASONS: ReadonlySet<EndedReason> = new Set(["declined", "stopped_by_place", "taken_over", "covered"]);
const NOTICE_MS = 30 * 86_400_000;


/** business-web-get-premier's read, for any caller (null = signed out). */
export async function readPremier(
  env: EFEnv,
  user: { id: string } | null,
  placeId: string,
  sessionId: string | null,
): Promise<Response> {
  const admin = adminClient(env);
  const periodsSince = Date.now() - NOTICE_MS - 86_400_000;
  let line = await readLine(admin, placeId, { periodsSince });
  if (!line.ok) return json({ ok: false, error: line.error }, 500);

  let outcome: ConfirmOutcome | undefined;
  if (sessionId && user) {
    outcome = "none";
    const own = line.pledges.find((p) => p.consumer_id === user.id && p.stripe_checkout_session_id === sessionId);
    const key = boostStripeKey();
    if (own && key) {
      try {
        outcome = await confirmPledge(admin, stripeClient(key), own, boostLivemode());
      } catch (err) {
        // The reply says pending; the cron settles it.
        console.error("[premier] get_confirm", JSON.stringify({ place_id: placeId, backing_id: own.id, error: String(err) }));
        outcome = "pending";
      }
      line = await readLine(admin, placeId, { periodsSince });
      if (!line.ok) return json({ ok: false, error: line.error }, 500);
    }
  }

  const placeRes = await readBoostPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);

  const now = Date.now();
  const running = runningPeriod(line.periods, now);
  const manual = runningManual(line.manual, now);
  const charging = chargingPeriod(line.periods) != null;
  const subscription = subscriptionOf(line.pledges);
  const viewer = user ? viewerOf({ consumerId: user.id, subscription, running, pledges: line.pledges }) : null;
  // The operator's prices (MESITA-3043), only when there are quotes to price.
  let prices: Awaited<ReturnType<typeof loadPremierPrices>> | undefined;
  if (user && viewer) {
    try {
      prices = await loadPremierPrices(admin);
    } catch (err) {
      console.error("[premier] prices", String(err));
      return json({ ok: false, error: "Premier prices are not available right now" }, 500);
    }
  }
  // The caller's own pledge: the subscription, or a Checkout in flight.
  const mine = user
    ? line.pledges.find((p) => p.consumer_id === user.id && (p.status === "ready" || p.status === "open")) ?? null
    : null;
  const paid = running
    ? {
      tier: running.tier,
      ends_at: running.ends_at,
      renews: !!subscription?.stripe_payment_method_id,
      by_you: viewer === "payer" || viewer === "former_payer",
    }
    : null;

  return json({
    ok: true,
    tier: placeRes.place?.boost_tier ?? 0,
    manual: manual ? { tier: manual.tier, ends_at: manual.ends_at, source: manual.source } : null,
    paid,
    renewing: charging,
    viewer,
    can_resume: viewer ? canResume({ viewer, running, pledges: line.pledges, charging }) : false,
    mine: mine
      ? {
        id: mine.id,
        tier: TIER_RANK[mine.tier],
        interval: mine.billing_interval,
        status: mine.status,
        pending: mine.pending_tier ? TIER_RANK[mine.pending_tier] : null,
        has_card: !!mine.stripe_payment_method_id,
        checkout: mine.checkout_kind,
      }
      : null,
    ended_notice: user ? endedNotice(line.pledges, line.periods, running, user.id, now) : null,
    quotes: user && viewer
      ? quotes({
        running,
        charging,
        viewer,
        subscription,
        now,
        manualTier: manual?.tier ?? 0,
        manual: line.manual,
        timeZone: placeRes.place?.timezone,
        prices,
      })
      : null,
    ...(outcome === undefined ? {} : { outcome }),
    // Builds before MESITA-3092 read these; one release.
    period: paid ? { tier: paid.tier, ends_at: paid.ends_at, granted: false, renews: paid.renews } : null,
    line: [],
    more: 0,
  });
}

/** The caller's latest subscription that ended for a reason they did not
 *  choose, within 30 days, not dismissed, and that paid at least once. */
function endedNotice(pledges: Pledge[], periods: Period[], running: Period | null, consumerId: string, now: number) {
  const ended = pledges
    .filter((p) =>
      p.consumer_id === consumerId && p.status === "ended" && p.ended_reason && NOTICE_REASONS.has(p.ended_reason) &&
      !p.notice_dismissed_at && p.ended_at && now - Date.parse(p.ended_at) < NOTICE_MS &&
      periods.some((x) => x.backing_id === p.id && (x.status === "paid" || x.status === "replaced"))
    )
    .sort((a, b) => Date.parse(b.ended_at!) - Date.parse(a.ended_at!))[0];
  if (!ended) return null;
  return {
    reason: ended.ended_reason,
    at: ended.ended_at,
    runs_until: running?.backing_id === ended.id ? running.ends_at : null,
    refund_cents: 0,
  };
}

/** business-web-start-premier's flow: a Checkout for this caller, or a
 *  change that needs none. */
export async function startPremier(
  env: EFEnv,
  user: { id: string; email: string | null },
  start: BoostStart,
): Promise<Response> {
  const userId = user.id;
  const key = boostStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);
  const stripe = stripeClient(key);
  const livemode = boostLivemode();

  const admin = adminClient(env);
  const placeRes = await readBoostPlace(admin, start.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, error: "This place can't be made Premier" }, 404);
  }

  const requestId = crypto.randomUUID();
  try {
    let line = await readLine(admin, start.placeId);
    if (!line.ok) throw new Error(line.error);
    const liveOf = (pledges: Pledge[]) =>
      pledges.find((p) => p.consumer_id === userId && (p.status === "open" || p.status === "ready")) ?? null;
    let mine = liveOf(line.pledges);

    // Settle this pledge's previous Checkout before anything else.
    if (mine?.checkout_kind && mine.stripe_checkout_session_id) {
      const outcome = await confirmPledge(admin, stripe, mine, livemode);
      if (outcome === "pending") {
        try {
          await stripe("POST", `checkout/sessions/${encodeURIComponent(mine.stripe_checkout_session_id)}/expire`);
        } catch (err) {
          console.error("[premier-start] expire_previous", mine.id, String(err));
        }
        const fresh = await readPledge(admin, mine.id);
        if (fresh) await confirmPledge(admin, stripe, fresh, livemode);
      }
      line = await readLine(admin, start.placeId);
      if (!line.ok) throw new Error(line.error);
      mine = liveOf(line.pledges);
    }

    const now = Date.now();
    const running = runningPeriod(line.periods, now);
    const subscription = subscriptionOf(line.pledges);
    const viewer = viewerOf({ consumerId: userId, subscription, running, pledges: line.pledges });
    const charging = chargingPeriod(line.periods) != null;

    // Read under the same try: no price, no Checkout (MESITA-3043).
    const prices = await loadPremierPrices(admin);
    let kind: CheckoutKind;
    let q: Quote;
    if (start.updateCard) {
      if (viewer !== "payer" || !subscription) return refuse("not_payer", "Only the guest who pays can update the card");
      kind = "update_card";
      q = { price_cents: subscription.amount_cents, charge_cents: 0, credit_cents: 0, extra_days: 0, new_ends_at: null, renews_at: null, kind: "change", blocked_by: null, checkout: "setup", covered: false };
    } else {
      q = quote({
        tier: start.tier,
        running,
        charging,
        viewer,
        subscription,
        now,
        manualTier: runningManual(line.manual, now)?.tier ?? 0,
        manual: line.manual,
        timeZone: place.timezone,
        prices,
      });
      if (q.covered) return refuse("covered_by_mesita", "Mesita already gives this place this level or more");
      if (q.blocked_by === "taken") return refuse("premier_taken", "Someone else pays for Premier here");
      if (q.kind === "blocked") return refuse("charging", "A renewal is being charged. Try again in a few minutes.");
      kind = q.kind === "buy" ? "buy" : q.kind === "resume" ? "resume" : "change";
    }
    const amount = boostAmountCents(start.tier, prices);

    if (q.checkout === "none" && subscription && viewer === "payer") {
      if (running && TIER_RANK[start.tier] > running.tier) {
        const outcome = await claimWithoutCheckout(admin, subscription, start.tier, start.interval, q, running.id, livemode);
        if (outcome === "covered") return refuse("covered_by_mesita", "Mesita already gives this place this level or more");
        if (outcome === "lost") return refuse("lost", "Premier changed while you were choosing. Look again.");
        return json({ ok: true, url: null, outcome: "confirmed" });
      }
      // A change at or below the running level: applies at the next renewal.
      const { error } = await admin
        .from("place_backings")
        .update({ tier: start.tier, billing_interval: start.interval, amount_cents: amount, updated_at: new Date().toISOString() })
        .eq("id", subscription.id);
      if (error) throw new Error(`pledge_update: ${error.message}`);
      return json({ ok: true, url: null, outcome: "updated" });
    }

    const customer = await ensureCustomer(admin, stripe, userId, user.email ?? null, livemode);

    // The payer's Checkout rides on their subscription; anything else is a
    // new pledge, which only premier_make_payer can make the subscription.
    let pledge: Pledge;
    let inserted = false;
    if (viewer === "payer" && subscription) {
      const patch: Record<string, unknown> = { checkout_kind: kind, updated_at: new Date().toISOString() };
      if (kind === "change") {
        Object.assign(patch, {
          pending_tier: start.tier,
          pending_interval: start.interval,
          pending_amount_cents: amount,
          quoted_period_id: running?.id ?? null,
          quoted_credit_cents: q.credit_cents,
        });
      }
      const { error } = await admin.from("place_backings").update(patch).eq("id", subscription.id);
      if (error) throw new Error(`pledge_update: ${error.message}`);
      pledge = (await readPledge(admin, subscription.id))!;
    } else {
      if (mine) {
        // An unfinished pledge of the caller's: it is replaced by this one.
        const { error } = await admin
          .from("place_backings")
          .update({ status: "ended", ended_reason: "left", ended_at: new Date().toISOString(), checkout_kind: null, updated_at: new Date().toISOString() })
          .eq("id", mine.id)
          .eq("status", "open");
        if (error) throw new Error(`pledge_replace: ${error.message}`);
      }
      const { data, error } = await admin
        .from("place_backings")
        .insert({
          place_id: start.placeId,
          consumer_id: userId,
          tier: start.tier,
          billing_interval: start.interval,
          amount_cents: amount,
          currency: PREMIER_CURRENCY,
          status: "open",
          livemode,
          checkout_kind: kind,
          quoted_period_id: running?.id ?? null,
          quoted_credit_cents: q.credit_cents,
        })
        .select("id")
        .single();
      if (error || !data) {
        if (error?.code === "23505") return refuse("lost", "Premier changed while you were choosing. Look again.");
        throw new Error(`pledge_insert: ${error?.message ?? "no row"}`);
      }
      inserted = true;
      pledge = (await readPledge(admin, data.id))!;
    }

    const session = await stripe(
      "POST",
      "checkout/sessions",
      pledgeCheckoutParams({
        mode: q.checkout === "payment" ? "payment" : "setup",
        kind,
        customer,
        backingId: pledge.id,
        placeId: start.placeId,
        consumerId: userId,
        tier: start.updateCard ? pledge.tier : start.tier,
        interval: start.updateCard ? pledge.billing_interval : start.interval,
        quote: q,
        placeName: String(place.name ?? "Mesita place"),
        returnUrl: start.returnUrl,
        nowSec: Math.floor(now / 1000),
      }),
    );
    const sessionId = String(session.id ?? "");

    // confirmPledge finds the Checkout through this id, so a row without it
    // is a payment nobody can confirm: retried once, then the session is
    // expired and no url is sent.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await admin
        .from("place_backings")
        .update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
        .eq("id", pledge.id);
      if (!error) return json({ ok: true, url: session.url });
      console.error(`[premier-start] session_write attempt ${attempt + 1}:`, error.message);
    }
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    } catch (err) {
      console.error("[premier-start] expire_failed", JSON.stringify({ backing_id: pledge.id, session_id: sessionId, error: String(err) }));
    }
    if (inserted) await admin.from("place_backings").delete().eq("id", pledge.id).eq("status", "open");
    else await admin.from("place_backings").update({ checkout_kind: null, updated_at: new Date().toISOString() }).eq("id", pledge.id);
    return json({ ok: false, error: "Couldn't open checkout. Try again.", request_id: requestId }, 502);
  } catch (err) {
    console.error("[premier] start", JSON.stringify({ request_id: requestId, place_id: start.placeId, consumer_id: userId, error: String(err) }));
    return json({ ok: false, error: "Couldn't open checkout. Try again.", request_id: requestId }, 502);
  }
}

/** business-web-cancel-premier's flow: the caller stops renewing their own
 *  subscription (or abandons their open Checkout). */
export async function cancelPremier(
  env: EFEnv,
  userId: string,
  target: { placeId?: unknown; backingId?: unknown },
): Promise<Response> {
  const placeId = target.placeId;
  const backingId = target.backingId;
  const admin = adminClient(env);
  const requestId = crypto.randomUUID();
  try {
    let pledge: Pledge | null;
    if (isUuid(placeId)) {
      const { data, error } = await admin
        .from("place_backings")
        .select(PLEDGE_COLUMNS)
        .eq("place_id", placeId)
        .eq("consumer_id", userId)
        .in("status", ["open", "ready"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`pledge_read: ${error.message}`);
      pledge = data as Pledge | null;
    } else {
      pledge = await readPledge(admin, backingId as string);
    }
    if (!pledge || pledge.consumer_id !== userId || pledge.status === "ended") {
      return json({ ok: false, error: "Subscription not found" }, 404);
    }
    const key = boostStripeKey();
    if (!key && (pledge.stripe_payment_method_id || pledge.checkout_kind)) {
      return json({ ok: false, error: "Payments are not available right now" }, 503);
    }
    await leavePledge(admin, key ? stripeClient(key) : null, pledge, pledge.status === "ready" ? "stopped" : "left");
    console.error("[premier] stopped", JSON.stringify({ place_id: pledge.place_id, consumer_id: userId, backing_id: pledge.id }));
    return json({ ok: true });
  } catch (err) {
    console.error("[premier] cancel", JSON.stringify({ request_id: requestId, consumer_id: userId, error: String(err) }));
    return json({ ok: false, error: "Couldn't stop renewing. Try again.", request_id: requestId }, 500);
  }
}

/** The place stops the subscription a guest pays (MESITA-3103). Only the
 *  running `ready` subscription; an open Checkout of a guest is theirs. */
export async function stopPremierAsPlace(env: EFEnv, placeId: string, actorUserId: string): Promise<Response> {
  const admin = adminClient(env);
  const requestId = crypto.randomUUID();
  try {
    const line = await readLine(admin, placeId);
    if (!line.ok) throw new Error(line.error);
    const subscription = subscriptionOf(line.pledges);
    if (!subscription) return json({ ok: false, code: "no_subscription", error: "No guest pays for Premier here" }, 404);
    const key = boostStripeKey();
    if (!key && subscription.stripe_payment_method_id) {
      return json({ ok: false, error: "Payments are not available right now" }, 503);
    }
    await leavePledge(admin, key ? stripeClient(key) : null, subscription, "stopped_by_place");
    console.error("[premier] stopped_by_place", JSON.stringify({ place_id: placeId, actor: actorUserId, backing_id: subscription.id }));
    return json({ ok: true });
  } catch (err) {
    console.error("[premier] stop_as_place", JSON.stringify({ request_id: requestId, place_id: placeId, error: String(err) }));
    return json({ ok: false, error: "Couldn't stop Premier. Try again.", request_id: requestId }, 500);
  }
}

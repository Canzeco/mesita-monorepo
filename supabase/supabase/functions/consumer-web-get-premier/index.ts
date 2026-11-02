// Supabase Edge Function — consumer-web-get-premier
//
// MESITA-3092: a place's Premier as its tab shows it — Manual Premier
// (Mesita's free lift, MESITA-3091) and the Paid subscription apart, who the
// caller is to it (`viewer`: payer, former_payer, stranger), whether they
// may resume, the notice of their own subscription that ended, and what each
// plan would mean for them right now (`quotes`, computed here; the UI never
// computes money). With `session_id` (Checkout's return, `?boost=`) it first
// settles the caller's own pledge through confirmPledge — only the session
// stored on that pledge, never one taken on trust — and says what happened
// (`outcome`). A guest who never comes back is settled by
// supabase-cron-sync-premier.
//
// Body: { place_id: uuid, session_id?: string }
// Response: { ok: true, tier, manual: { tier, ends_at } | null,
//             paid: { tier, ends_at, renews, by_you } | null,
//             renewing: boolean, viewer: Viewer | null, can_resume: boolean,
//             mine: MinePledge | null, ended_notice: EndedNotice | null,
//             quotes: Record<tier, Record<interval, Quote>> | null,
//             outcome?: ConfirmOutcome,
//             period, line: [], more: 0 }  (the last three for builds
//             before MESITA-3092, one release)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  boostLivemode,
  boostStripeKey,
  canResume,
  chargingPeriod,
  type ConfirmOutcome,
  confirmPledge,
  type EndedReason,
  type Period,
  type Pledge,
  quotes,
  readBoostPlace,
  readLine,
  runningManual,
  runningPeriod,
  stripeClient,
  subscriptionOf,
  TIER_RANK,
  viewerOf,
} from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";

/** Reasons the former payer is told about, for 30 days (E2). */
const NOTICE_REASONS: ReadonlySet<EndedReason> = new Set(["declined", "stopped_by_place", "taken_over", "covered"]);
const NOTICE_MS = 30 * 86_400_000;

serveJson("consumer-web-get-premier", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const { user } = await getOptionalAuthedUser(req, envRes.env);

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const sessionId = typeof bodyRes.body.session_id === "string" ? bodyRes.body.session_id : null;

  const admin = adminClient(envRes.env);
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
    manual: manual ? { tier: manual.tier, ends_at: manual.ends_at } : null,
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
      ? quotes({ running, charging, viewer, subscription, now, manualTier: manual?.tier ?? 0 })
      : null,
    ...(outcome === undefined ? {} : { outcome }),
    // Builds before MESITA-3092 read these; one release.
    period: paid ? { tier: paid.tier, ends_at: paid.ends_at, granted: false, renews: paid.renews } : null,
    line: [],
    more: 0,
  });
});

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

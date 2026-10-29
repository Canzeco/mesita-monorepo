// Supabase Edge Function — consumer-web-get-boost
//
// MESITA-2995: a place's Premier as its tab shows it — the period running,
// the line (payer first, then backups; levels only, never names:
// MESITA-2928), the signed-in guest's own pledge, and what each level would
// mean for them right now (`quotes`, computed here; the UI never computes
// money). With `session_id` (Checkout's return, `?boost=`) it first settles
// the caller's own pledge through confirmPledge — only the session stored on
// that pledge, never one taken on trust — and says what happened (`outcome`).
// A guest who never comes back is settled by supabase-cron-sync-boosts.
//
// Body: { place_id: uuid, session_id?: string }
// Response: { ok: true, tier, period: { tier, ends_at, granted, renews } | null,
//             renewing: boolean, line: LineRow[], more: number,
//             mine: MinePledge | null, quotes: Record<tier, Record<interval, Quote>> | null,
//             outcome?: "confirmed" | "saved_as_backup" | "released_stale" | "pending" | "expired" | "none" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  boostLivemode,
  boostStripeKey,
  chargingPeriod,
  type ConfirmOutcome,
  confirmPledge,
  isUuid,
  ladder,
  lineView,
  quotes,
  readBoostPlace,
  readLine,
  runningPeriod,
  stripeClient,
  TIER_RANK,
} from "../_shared/boost.ts";

serveJson("consumer-web-get-boost", async (req) => {
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
  let line = await readLine(admin, placeId);
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
        console.error("[consumer-web-get-boost] confirm:", err);
        outcome = "pending";
      }
      line = await readLine(admin, placeId);
      if (!line.ok) return json({ ok: false, error: line.error }, 500);
    }
  }

  const placeRes = await readBoostPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);

  const now = Date.now();
  const running = runningPeriod(line.periods, now);
  const charging = chargingPeriod(line.periods);
  const view = lineView(line.pledges, running, user?.id ?? null);
  const mine = user ? line.pledges.find((p) => p.consumer_id === user.id) ?? null : null;
  const payerId = running?.backing_id ?? null;
  const backups = ladder(line.pledges).filter((p) => p.id !== payerId);
  const minePosition = mine ? backups.findIndex((p) => p.id === mine.id) + 1 : 0;

  return json({
    ok: true,
    tier: placeRes.place?.boost_tier ?? 0,
    period: running
      ? {
        tier: running.tier,
        ends_at: running.ends_at,
        granted: running.backing_id == null,
        // Renews when anyone with a saved card stands in line.
        renews: ladder(line.pledges).length > 0,
      }
      : null,
    renewing: charging != null,
    line: view.line,
    more: view.more,
    mine: mine
      ? {
        id: mine.id,
        tier: TIER_RANK[mine.tier],
        interval: mine.billing_interval,
        status: mine.status,
        role: payerId === mine.id ? "payer" : "backup",
        position: payerId === mine.id ? 0 : minePosition,
        pending: mine.pending_tier ? TIER_RANK[mine.pending_tier] : null,
        has_card: !!mine.stripe_payment_method_id,
      }
      : null,
    quotes: user
      ? quotes({ running, charging: charging != null, pledges: line.pledges, mine, now })
      : null,
    ...(outcome === undefined ? {} : { outcome }),
  });
});

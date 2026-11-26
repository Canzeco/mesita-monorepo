// Supabase Edge Function — consumer-web-get-plan
//
// MESITA-3870. Me › Plan: the guest's plan (Free or Pro), this month's
// reservations against its cap, and Pro's price. When a Pro subscription is
// on file it is read back from Stripe first (there is no webhook,
// _shared/guest-plan.ts), so a renewal or a cancellation shows on open.
//
// Body: { session_id?: string, light?: boolean }
//   session_id  Checkout's return (`?plan=<id>`)
//   light       the reserve form's read (MESITA-4393): skip the Stripe sync
//               unless a session_id is present or the stored Pro needs a
//               refresh (create-reservation's needsRefresh rule). Me › Plan
//               never sends it, so its read is unchanged.
// Response: { ok: true, plan: "free" | "premium", granted: boolean,
//             cap, used, price_cents, currency, paid_until, cancel_at_period_end,
//             cap_lifted?, cap_override?, test_call?, confirmed?: "paid" | "pending" | "failed" }
//   confirmed (MESITA-4915): only with a session_id. `pending` is the guest's
//   own Checkout that can still be paid; `failed` is terminal; left out when
//   Stripe could not be read, so the app keeps the id and asks again.
//   cap_lifted / cap_override (MESITA-4393, _shared/plan-flags.ts) are left
//   out when the settings read fails; the web form then fails open.
//   test_call (MESITA-5000): true while Who the agent calls is Test number
//   or Guest's phone. The reserve form adds its Test step only then.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { boostLivemode, boostStripeKey, StripeError, stripeClient } from "../_shared/stripe.ts";
import {
  effectivePlan,
  mayAdopt,
  needsRefresh,
  PLAN_COLUMNS,
  type PlanRow,
  PRO_CURRENCY,
  PRO_PRICE_CENTS,
  readSubscription,
  reservationsThisMonth,
  sessionOutcome,
  subscriptionOfSession,
  syncPlan,
} from "../_shared/guest-plan.ts";
import { monthlyReservationCap } from "../_shared/reservation-cap.ts";
import { planFlags } from "../_shared/plan-flags.ts";
import { DEFAULT_ZONE, zoneMonthStart } from "../_shared/local-time.ts";

serveJson("consumer-web-get-plan", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const rawSession = bodyRes.body.session_id;
  const sessionId = typeof rawSession === "string" && /^cs_[A-Za-z0-9_]+$/.test(rawSession) ? rawSession : null;
  const light = bodyRes.body.light === true;

  const { data, error } = await admin.from("consumers").select(PLAN_COLUMNS).eq("id", user.id).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  let row = (data ?? null) as PlanRow | null;
  if (!row) return json({ ok: false, code: "no_account", error: "Sign in to see your plan." }, 404);

  const key = boostStripeKey();
  const livemode = boostLivemode();
  let confirmed: "paid" | "pending" | "failed" | undefined;
  // A `plan=` value that is no Checkout id can never be paid.
  if (typeof rawSession === "string" && rawSession !== "" && !sessionId) confirmed = "failed";

  if (key && (!light || sessionId || needsRefresh(row, Date.now(), livemode))) {
    const stripe = stripeClient(key);
    try {
      let subId = typeof row.plan_stripe_subscription === "string" ? row.plan_stripe_subscription : null;
      if (sessionId) {
        let session: Record<string, unknown> | null = null;
        try {
          session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
        } catch (err) {
          // Not a session of this Stripe account: nothing to wait for.
          if (!(err instanceof StripeError) || err.httpStatus !== 404) throw err;
        }
        const fromSession = session ? subscriptionOfSession(session, user.id) : null;
        const sub = fromSession ? await stripe("GET", `subscriptions/${encodeURIComponent(fromSession)}`) : null;
        const outcome = session ? sessionOutcome(session, user.id, sub, Date.now()) : "failed";
        let adopted = false;
        if (fromSession && sub && mayAdopt(row, fromSession, readSubscription(sub, Date.now()))) {
          row = await syncPlan(admin, stripe, user.id, fromSession, livemode);
          adopted = true;
        }
        // "paid" only once the row says so.
        confirmed = outcome === "paid" && effectivePlan(row, Date.now(), livemode) !== "premium" ? "pending" : outcome;
        if (adopted) subId = null;
      }
      if (subId && row.plan_livemode === livemode) {
        row = await syncPlan(admin, stripe, user.id, subId, livemode);
      }
    } catch (err) {
      // The page still reads; the stored answer stands until the next open.
      console.error("[consumer-web-get-plan] sync_failed", JSON.stringify({ consumer_id: user.id, error: String(err) }));
    }
  }

  const now = Date.now();
  const plan = effectivePlan(row, now, livemode);
  const granted = plan === "premium" && !row.plan_stripe_subscription;
  let used = 0;
  try {
    used = await reservationsThisMonth(admin, user.id, zoneMonthStart(new Date(now), DEFAULT_ZONE).toISOString());
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }

  // The testing switch, read as consumer-web-create-reservation reads it
  // (_shared/plan-flags.ts). A failed read leaves both flags out.
  const { data: settingsRow, error: settingsError } = await admin
    .from("app_config")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const flags = planFlags(row, settingsRow?.reservations_config, !!settingsError);

  return json({
    ok: true,
    plan,
    granted,
    cap: monthlyReservationCap({ plan, reservation_cap_override: row.reservation_cap_override }),
    used,
    price_cents: PRO_PRICE_CENTS,
    currency: PRO_CURRENCY,
    paid_until: plan === "premium" && !granted ? row.plan_paid_until ?? null : null,
    cancel_at_period_end: plan === "premium" && !granted && row.plan_cancel_at_period_end === true,
    ...(flags ?? {}),
    ...(confirmed ? { confirmed } : {}),
  });
});

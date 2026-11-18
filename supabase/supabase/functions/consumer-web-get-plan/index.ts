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
//             cap_lifted?, cap_override?, confirmed?: "paid" | "pending" }
//   cap_lifted / cap_override (MESITA-4393, _shared/plan-flags.ts) are left
//   out when the settings read fails; the web form then fails open.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/stripe.ts";
import {
  effectivePlan,
  needsRefresh,
  PLAN_COLUMNS,
  type PlanRow,
  PRO_CURRENCY,
  PRO_PRICE_CENTS,
  reservationsThisMonth,
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
  let confirmed: "paid" | "pending" | undefined;

  if (key && (!light || sessionId || needsRefresh(row, Date.now(), livemode))) {
    const stripe = stripeClient(key);
    try {
      let subId = typeof row.plan_stripe_subscription === "string" ? row.plan_stripe_subscription : null;
      if (sessionId) {
        confirmed = "pending";
        const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
        const fromSession = subscriptionOfSession(session, user.id);
        if (fromSession) subId = fromSession;
      }
      if (subId && (row.plan_livemode === livemode || sessionId)) {
        row = await syncPlan(admin, stripe, user.id, subId, livemode);
        if (sessionId && effectivePlan(row, Date.now(), livemode) === "premium") confirmed = "paid";
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

// Supabase Edge Function — admin-web-try-card-pay
//
// MESITA-3571 (Pay at the table, T0 of MESITA-3563): a TEMPORARY door that
// proves the card part's Stripe path before it is built. In TEST mode only,
// on the test platform customer, for a plain card (4242) and a 3-D Secure
// card (pm_card_authenticationRequired, attached for the run): clone the
// platform PaymentMethod to the place's connected account, create and
// confirm a PaymentIntent there (payment_method_types card, use_stripe_sdk,
// an Idempotency-Key), then clean up: a succeeded one is refunded, an
// unfinished one is cancelled. No mesita_kind metadata, so the Connect
// receiver ignores every event it makes. Answers ids, statuses and Stripe
// error codes only; never a client_secret, never a key. Super-admin only.
// Retired in T2b's PR (folder + config.toml).
//
// Body: {} (optional { amount_cents })
// Response: { ok, mode: "test", account, customer, cases: [...] }
// Errors: 409 live_mode · 503 not_configured

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { paymentsLivemode, paymentsStripeKey, type StripeCall, stripeClient, StripeError } from "../_shared/boost.ts";

const ACCOUNT = "acct_1UFmLHD5UbELfiCG";
const CUSTOMER = "cus_Vb0BHZc1T7AhIm";

type Case = Record<string, unknown>;

function errOf(err: unknown): Case {
  if (err instanceof StripeError) {
    return { error_path: err.path, error_type: err.type, error_code: err.code, http_status: err.httpStatus, error_message: err.message };
  }
  return { error_message: err instanceof Error ? err.message : String(err) };
}

async function tryCard(stripe: StripeCall, label: string, platformPm: string, amount: number, run: string): Promise<Case> {
  const out: Case = { card: label, platform_pm: platformPm };
  let cloned: string;
  try {
    const pm = await stripe("POST", "payment_methods", { customer: CUSTOMER, payment_method: platformPm }, {
      stripeAccount: ACCOUNT,
      idempotencyKey: `try-card-clone-${run}-${label}`,
    });
    cloned = String(pm.id);
    out.clone = { ok: true, id: cloned, customer_on_account: pm.customer ?? null };
  } catch (err) {
    out.clone = { ok: false, ...errOf(err) };
    return out;
  }
  let pi: Record<string, unknown>;
  try {
    pi = await stripe("POST", "payment_intents", {
      amount,
      currency: "mxn",
      payment_method: cloned,
      payment_method_types: ["card"],
      confirm: true,
      use_stripe_sdk: true,
      description: "Mesita card spike (test)",
      metadata: { mesita_spike: "MESITA-3571" },
    }, { stripeAccount: ACCOUNT, idempotencyKey: `try-card-pi-${run}-${label}` });
  } catch (err) {
    out.payment_intent = { ok: false, ...errOf(err) };
    return out;
  }
  const next = (pi.next_action ?? null) as { type?: string } | null;
  out.payment_intent = {
    ok: true,
    id: pi.id,
    status: pi.status,
    livemode: pi.livemode,
    next_action_type: next?.type ?? null,
    has_client_secret: typeof pi.client_secret === "string",
    application_fee_amount: pi.application_fee_amount ?? null,
    latest_charge: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
  };
  try {
    if (pi.status === "succeeded") {
      const r = await stripe("POST", "refunds", { payment_intent: String(pi.id) }, {
        stripeAccount: ACCOUNT,
        idempotencyKey: `try-card-refund-${run}-${label}`,
      });
      out.cleanup = { action: "refund", status: r.status };
    } else if (pi.status !== "canceled") {
      const c = await stripe("POST", `payment_intents/${encodeURIComponent(String(pi.id))}/cancel`, {}, {
        stripeAccount: ACCOUNT,
        idempotencyKey: `try-card-cancel-${run}-${label}`,
      });
      out.cleanup = { action: "cancel", status: c.status };
    }
  } catch (err) {
    out.cleanup = { ok: false, ...errOf(err) };
  }
  return out;
}

serveJson("admin-web-try-card-pay", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  const raw = bodyRes.ok ? bodyRes.body.amount_cents : undefined;
  const amount = typeof raw === "number" && Number.isInteger(raw) && raw >= 1000 && raw <= 100000 ? raw : 5000;

  if (paymentsLivemode()) return json({ ok: false, code: "live_mode", error: "Test mode only" }, 409);
  const key = paymentsStripeKey();
  if (!key || !key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    return json({ ok: false, code: "not_configured", error: "No Stripe test key" }, 503);
  }
  const stripe = stripeClient(key);
  const run = crypto.randomUUID();

  const cases: Case[] = [];
  // The saved Visa 4242 on the test platform customer.
  let visa: string | null = null;
  try {
    const list = await stripe("GET", `customers/${CUSTOMER}/payment_methods`, { type: "card", limit: 10 });
    const data = Array.isArray(list.data) ? (list.data as Record<string, unknown>[]) : [];
    const hit = data.find((pm) => (pm.card as { last4?: string } | null)?.last4 === "4242");
    visa = hit ? String(hit.id) : null;
  } catch (err) {
    cases.push({ card: "4242", list: { ok: false, ...errOf(err) } });
  }
  if (visa) cases.push(await tryCard(stripe, "4242", visa, amount, run));
  else if (!cases.length) cases.push({ card: "4242", list: { ok: false, error_message: "no 4242 on the test customer" } });

  // A 3-D Secure card, attached for this run and detached after.
  let threeDs: string | null = null;
  try {
    const pm = await stripe("POST", "payment_methods/pm_card_authenticationRequired/attach", { customer: CUSTOMER });
    threeDs = String(pm.id);
  } catch (err) {
    cases.push({ card: "3ds", attach: { ok: false, ...errOf(err) } });
  }
  if (threeDs) {
    const c = await tryCard(stripe, "3ds", threeDs, amount, run);
    try {
      await stripe("POST", `payment_methods/${threeDs}/detach`, {});
      c.detached = true;
    } catch (err) {
      c.detached = { ok: false, ...errOf(err) };
    }
    cases.push(c);
  }

  console.log("try_card_pay", JSON.stringify({ actor: ctx.user.id, run, cases: cases.length }));
  return json({ ok: true, mode: "test", account: ACCOUNT, customer: CUSTOMER, amount_cents: amount, cases });
});

// Supabase Edge Function — consumer-web-remove-card
//
// MESITA-3523: Remove on a saved card's sheet. Detaches the card from the
// guest's platform customer. The card must be on the caller's own customer
// (the id from the browser is checked with Stripe), and a card a live
// Premier pledge renews with is refused (in_use). A card already gone
// answers ok: removing is idempotent.
//
// Body: { payment_method_id: string }
// Response: { ok: true }
//   400 (malformed id) · 401 sign_in · 404 not_found · 409 in_use ·
//   503 (Stripe not configured) · 502 remove_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { paymentsLivemode, paymentsStripeKey, readCustomer, StripeError, stripeClient } from "../_shared/boost.ts";
import { premierCards, removeCheck } from "../_shared/cards.ts";
import { errorMessage } from "../_shared/errors.ts";

const PM_ID = /^pm_[A-Za-z0-9]{6,64}$/;

serveJson("consumer-web-remove-card", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to remove a card" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const pmId = bodyRes.body.payment_method_id;
  if (typeof pmId !== "string" || !PM_ID.test(pmId)) return json({ ok: false, error: "payment_method_id is not a card id" }, 400);

  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, error: "Cards are not available right now" }, 503);
  const userId = user.id;
  const livemode = paymentsLivemode();
  const stripe = stripeClient(key);
  try {
    const customer = await readCustomer(admin, userId, livemode);
    let pm: Record<string, unknown> | null = null;
    try {
      pm = await stripe("GET", `payment_methods/${encodeURIComponent(pmId)}`);
    } catch (err) {
      if (!(err instanceof StripeError && err.code === "resource_missing")) throw err;
    }
    // Already detached (no customer) and once ours: nothing left to do.
    if (pm && pm.customer === null) return json({ ok: true });
    const check = removeCheck(pm, customer, await premierCards(admin, userId));
    if (!check.ok) return json({ ok: false, code: check.code, error: check.error }, check.status);
    await stripe("POST", `payment_methods/${encodeURIComponent(pmId)}/detach`);
    console.log("[consumer-web-remove-card]", JSON.stringify({ outcome: "removed", livemode }));
    return json({ ok: true });
  } catch (err) {
    console.error("[consumer-web-remove-card]", JSON.stringify({ error: errorMessage(err) }));
    return json({ ok: false, code: "remove_failed", error: "Couldn't remove the card. Try again." }, 502);
  }
});

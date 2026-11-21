// Supabase Edge Function — business-web-get-place-payouts
//
// MESITA-4538: Business › Monitor › Payments, "Payouts to your bank" (Pato:
// "it must include payments and payouts to your bank"). Ten payouts read live
// from Stripe on the place's connected account. A missing account or a Stripe
// failure is an answer (state), never a 500, so the payments list still shows.
// The owner and Mesita staff only.
//
// Body: { place_id, before?: payout id }
// Response: { ok, state: ok|no_account|stripe_error, payouts?, next? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readAccount } from "../_shared/payments.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { readPayouts } from "../_shared/monitor.ts";

serveJson("business-web-get-place-payouts", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, before } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (before != null && (typeof before !== "string" || !/^po_[A-Za-z0-9]+$/.test(before))) {
    return json({ ok: false, error: "before must be a payout id" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const key = paymentsStripeKey();
  if (!key) return json({ ok: true, state: "no_account" });
  const account = await readAccount(admin, placeId);
  const usable = account && account.livemode === paymentsLivemode() ? account.stripe_account_id : null;
  const answer = await readPayouts(stripeClient(key), usable, typeof before === "string" ? before : null);
  return json({ ok: true, ...answer });
});

// Supabase Edge Function — business-web-open-payment-dashboard
//
// MESITA-3296: Business › Payments, "Open Stripe". A one-time link into the
// place's Express dashboard (balance, payouts, payments), which has no login
// of its own. The owner and Mesita staff only. An account created with no
// dashboard gets a plain refusal.
//
// Body: { place_id: uuid }
// Response: { ok: true, url: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode, paymentsStripeKey, StripeError, stripeClient } from "../_shared/boost.ts";
import { readAccount } from "../_shared/payments.ts";

serveJson("business-web-open-payment-dashboard", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, code: "stripe_off", error: "Stripe isn't set up on this server" }, 503);
  const account = await readAccount(admin, placeId);
  if (!account || account.livemode !== paymentsLivemode()) {
    return json({ ok: false, code: "no_account", error: "Connect Stripe first" }, 409);
  }
  try {
    const link = await stripeClient(key)("POST", `accounts/${account.stripe_account_id}/login_links`);
    return json({ ok: true, url: String(link.url) });
  } catch (err) {
    console.error(`[business-web-open-payment-dashboard] ${placeId}: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof StripeError) {
      return json({ ok: false, code: "stripe", error: "Stripe couldn't open the dashboard right now." }, 502);
    }
    throw err;
  }
});

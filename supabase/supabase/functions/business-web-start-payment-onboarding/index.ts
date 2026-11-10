// Supabase Edge Function — business-web-start-payment-onboarding
//
// MESITA-3296: Business › Payments, "Connect Stripe". Creates the place's
// Stripe Connect account if it has none (the posture is _shared/payments.ts:
// the place is the merchant of record and pays Stripe, Stripe bears losses,
// Mesita never holds the money) and answers a Stripe-hosted onboarding link.
// Calling it again on an account still onboarding answers a fresh link. The
// owner and Mesita staff only: the account is the place's own Stripe
// relationship. Test mode until Pato flips PAYMENTS_STRIPE_MODE; agents never do.
//
// No charge is made here, ever: this is the account layer only.
//
// Body: { place_id: uuid, return_url: string, country?: MX|US }
// Response: { ok: true, url: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode, paymentsStripeKey, isAllowedReturnUrl, StripeError, stripeClient } from "../_shared/boost.ts";
import {
  accountCreateParams,
  ACCOUNT_COLUMNS,
  type AccountRow,
  CONNECT_CONTROLLER,
  CONNECT_CONTROLLER_NO_DASHBOARD,
  connectApiVersion,
  isConnectCountry,
  isDashboardPairRefusal,
  readAccount,
  snapshotFromStripe,
} from "../_shared/payments.ts";

serveJson("business-web-start-payment-onboarding", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, return_url: returnUrl } = bodyRes.body;
  const country = bodyRes.body.country ?? "MX";
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return json({ ok: false, error: "return_url is not a Mesita address" }, 400);
  }
  // Permanent on the account Stripe is about to create, so checked first.
  if (!isConnectCountry(country)) return json({ ok: false, code: "invalid", error: "country must be MX or US" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, code: "stripe_off", error: "Stripe isn't set up on this server" }, 503);
  const stripe = stripeClient(key);
  const livemode = paymentsLivemode();

  try {
    let account = await readAccount(admin, placeId);
    // An account from the other universe is unreachable with this key: it is
    // replaced, and the old row's id stays in the log.
    if (account && account.livemode !== livemode) {
      console.warn(`[business-web-start-payment-onboarding] ${placeId}: replacing ${account.stripe_account_id} (other mode)`);
      account = null;
    }
    if (!account) {
      // Stripe's onboarding asks the business name itself; only the owner's
      // email is prefilled, so no place read happens here.
      const params = accountCreateParams({ placeId, country, name: null, website: null, email: user.emailLower ?? null });
      const version = connectApiVersion();
      let created: Record<string, unknown>;
      try {
        created = await stripe("POST", "accounts", { ...params, controller: CONNECT_CONTROLLER }, {
          idempotencyKey: `connect:${placeId}:${livemode ? "live" : "test"}:express`,
          version,
        });
      } catch (err) {
        if (!(err instanceof StripeError) || !isDashboardPairRefusal(err.message)) throw err;
        console.warn(`[business-web-start-payment-onboarding] Stripe refused Express with the place paying (${version}); creating with no dashboard`);
        created = await stripe("POST", "accounts", { ...params, controller: CONNECT_CONTROLLER_NO_DASHBOARD }, {
          idempotencyKey: `connect:${placeId}:${livemode ? "live" : "test"}:none`,
        });
      }
      const row = { place_id: placeId, stripe_account_id: String(created.id), ...snapshotFromStripe(created, livemode) };
      const { data, error } = await admin.from("place_payment_accounts").upsert(row).select(ACCOUNT_COLUMNS).single();
      if (error) return json({ ok: false, error: `place_payment_accounts: ${error.message}` }, 500);
      account = data as AccountRow;
    }

    const base = new URL(returnUrl);
    base.searchParams.set("stripe", "return");
    const refresh = new URL(returnUrl);
    refresh.searchParams.set("stripe", "refresh");
    const link = await stripe("POST", "account_links", {
      account: account.stripe_account_id,
      type: "account_onboarding",
      return_url: base.toString(),
      refresh_url: refresh.toString(),
    });
    return json({ ok: true, url: String(link.url) });
  } catch (err) {
    // Stripe's words go to the log; the owner reads one sentence.
    console.error(`[business-web-start-payment-onboarding] ${placeId}: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof StripeError) {
      return json({ ok: false, code: "stripe", error: "Stripe couldn't open the setup right now. Try again in a minute." }, 502);
    }
    return json({ ok: false, error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});

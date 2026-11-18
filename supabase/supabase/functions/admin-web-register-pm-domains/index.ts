// Supabase Edge Function — admin-web-register-pm-domains
//
// MESITA-4384: registers mesita.ai and www.mesita.ai as payment method
// domains (Apple Pay, Google Pay) on every connected account that can
// charge, in the CURRENT payments mode (Stripe needs each domain per
// connected account and per environment), and stamps what Stripe says. The
// per-environment backfill, and the repair and check tool: safe to re-run.
// LAUNCH CHECKLIST: run it again in live when payments go live.
//
// Body: {} (every account in this mode) or { place_id: uuid } (one place).
// Response: { ok: true, livemode, accounts: [{ place_id, account_id,
//   apple_pay: bool, google_pay: bool, error? }] } — partial results; an
//   account's error never stops the others.
// Refusals: 401 sign_in · 403 forbidden (super-admin only) · 400 bad_body ·
//   503 payments not configured.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { type DomainReport, registerAndStamp } from "../_shared/pm-domains.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("admin-web-register-pm-domains", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<Record<string, unknown>>(req, {});
  const placeId = body.place_id;
  if (placeId !== undefined && placeId !== null && !isUuid(placeId)) {
    return json({ ok: false, code: "bad_body", field: "place_id", error: "place_id must be a Mesita place id" }, 400);
  }
  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);
  const stripe = stripeClient(key);
  const livemode = paymentsLivemode();

  let q = admin.from("place_payment_accounts").select("place_id, stripe_account_id").eq("livemode", livemode).eq("charges_enabled", true);
  if (typeof placeId === "string") q = q.eq("place_id", placeId);
  const { data, error } = await q;
  if (error) return json({ ok: false, error: `place_payment_accounts: ${error.message}` }, 500);

  const accounts: DomainReport[] = [];
  for (const a of (data ?? []) as Array<{ place_id: string; stripe_account_id: string }>) {
    try {
      accounts.push(await registerAndStamp(admin, stripe, { placeId: a.place_id, accountId: a.stripe_account_id, livemode, force: true }));
    } catch (err) {
      accounts.push({ place_id: a.place_id, account_id: a.stripe_account_id, apple_pay: false, google_pay: false, error: String(err).slice(0, 200) });
    }
  }
  console.log("[admin-web-register-pm-domains]", JSON.stringify({
    livemode,
    accounts: accounts.length,
    apple_pay: accounts.filter((a) => a.apple_pay).length,
    google_pay: accounts.filter((a) => a.google_pay).length,
    errors: accounts.filter((a) => a.error).length,
  }));
  return json({ ok: true, livemode, accounts });
});

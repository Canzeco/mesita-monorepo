// Supabase Edge Function — consumer-web-start-premier
//
// MESITA-3092: one Paid subscription per place. What choosing a plan takes
// comes from the server's quote (_shared/boost.ts `quote`):
//   - buy: no subscription and no paid period run → a new pledge and a
//     Checkout `payment` at full price, held until it is confirmed;
//   - change (the payer, or the former payer above their running level):
//     an upgrade pays now minus the unused paid days (Checkout `payment`, or
//     no Checkout when the credit covers it on the saved card); at or below
//     the running level the new terms apply at the next renewal;
//   - resume (the former payer at or below the running level): a Checkout
//     `setup` saves a card; the first charge is at the running period's end;
//   - update_card (`kind: "update_card"`, the payer): a Checkout `setup`
//     replaces the saved card.
// A previous Checkout of the caller's pledge is settled first (paid ones
// confirmed, open ones expired), so a payment is never orphaned.
//
// Body: { place_id: uuid, tier: "boost_2x" | "boost_5x",
//         interval?: "month" | "year", return_url: string }
//     | { place_id: uuid, kind: "update_card", return_url: string }
// Response: { ok: true, url: string | null, outcome?: "updated" | "confirmed" }
//         | { ok: false, code: "covered_by_mesita" | "premier_taken" | "charging"
//                              | "not_payer" | "lost", error }  (HTTP 200)
//
// Stripe stays in test mode until Pato flips STRIPE_MODE and STRIPE_ALLOW_LIVE.
//
// The flow is `_shared/premier-flow.ts` `startPremier` (MESITA-3103), shared
// with business-web-start-premier.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { parseBoostStart } from "../_shared/boost.ts";
import { startPremier } from "../_shared/premier-flow.ts";

serveJson("consumer-web-start-premier", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parseBoostStart(bodyRes.body);
  if (!parsed.ok) {
    return json({ ok: false, ...(parsed.code ? { code: parsed.code } : {}), error: parsed.error }, 400);
  }
  return await startPremier(envRes.env, { id: authRes.user.id, email: authRes.user.email }, parsed.start);
});

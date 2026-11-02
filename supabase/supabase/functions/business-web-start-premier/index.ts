// Supabase Edge Function — business-web-start-premier
//
// MESITA-3103. Whoever runs the place buys or changes its Premier: the same
// flow as the guest's (`_shared/premier-flow.ts` startPremier), billed to the
// caller's own card through Stripe Checkout. The caller needs a consumers row
// (a phone sign-in): Premier's payer is a guest account.
//
// Body: consumer-web-start-premier's body
// Response: consumer-web-start-premier's response, or code `no_payer_account`

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { ensureConsumer, requireBusinessRequest } from "../_shared/business-request.ts";
import { parseBoostStart } from "../_shared/boost.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { startPremier } from "../_shared/premier-flow.ts";

serveJson("business-web-start-premier", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parseBoostStart(bodyRes.body);
  if (!parsed.ok) {
    return json({ ok: false, ...(parsed.code ? { code: parsed.code } : {}), error: parsed.error }, 400);
  }

  const access = await requirePlaceAccess(admin, user, parsed.start.placeId);
  if (access instanceof Response) return access;

  const consumer = await ensureConsumer(admin, user);
  if (!consumer.ok) return json({ ok: false, error: consumer.error, code: consumer.code ?? null }, consumer.status);
  if (!consumer.consumerId) {
    return json({ ok: false, code: "no_payer_account", error: "Sign in with your phone number to pay for Premier" });
  }

  return await startPremier(env, { id: user.id, email: user.email }, parsed.start);
});

// Supabase Edge Function — business-web-start-premier
//
// MESITA-3103. Whoever runs the place buys or changes its Premier
// (`_shared/premier-flow.ts` startPremier), billed to the
// caller's own card through Stripe Checkout. The caller needs a consumers row
// (a phone sign-in): Premier's payer is a guest account.
//
// `kind: "update_card"` is the payer's own card (MESITA-3130): it asks for no
// place access, since startPremier refuses anyone but the payer (`not_payer`),
// so a payer who no longer runs the place can still replace their card.
//
// Body: parseBoostStart's body (`_shared/boost.ts`)
// Response: startPremier's response, or code `no_payer_account`

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { ensureConsumer } from "../_shared/business-request.ts";
import { parseBoostStart } from "../_shared/boost.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
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

  if (!parsed.start.updateCard) {
    const access = await requirePlaceAccess(admin, user, parsed.start.placeId);
    if (access instanceof Response) return access;
    // Premier money is the owner's (MESITA-3120): editors see it, never buy or stop it.
    if (!canManage(access.role)) return ownerOnly();
  }

  const consumer = await ensureConsumer(admin, user);
  if (!consumer.ok) return json({ ok: false, error: consumer.error, code: consumer.code ?? null }, consumer.status);
  if (!consumer.consumerId) {
    return json({ ok: false, code: "no_payer_account", error: "Sign in with your phone number to pay for Premier" });
  }

  return await startPremier(env, { id: user.id, email: user.email }, parsed.start);
});

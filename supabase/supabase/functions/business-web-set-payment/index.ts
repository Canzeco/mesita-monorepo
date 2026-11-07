// Supabase Edge Function — business-web-set-payment
//
// MESITA-3296: Business › Payments, one switch: Payments Cashback or one of the
// six Prepaid Vouchers, on or off. The owner and Mesita staff only: it is the
// place's money. Nothing charges yet: the switch records intent.
//
// Body: { place_id: uuid, key: cashback|voucher_200|voucher_1000|voucher_5000|
//         voucher_welcome|voucher_story|voucher_vip, enabled: boolean }
// Response: { ok: true, settings: { ...every switch } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { isPaymentKey, readSettings } from "../_shared/payments.ts";

serveJson("business-web-set-payment", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, key, enabled } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (!isPaymentKey(key)) return json({ ok: false, code: "invalid", error: "Unknown switch" }, 400);
  if (typeof enabled !== "boolean") return json({ ok: false, code: "invalid", error: "enabled must be true or false" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  // Only this switch is named, so the others keep what they were.
  const { error } = await admin.from("place_payment_settings").upsert({
    place_id: placeId,
    [key]: enabled,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) return json({ ok: false, error: `place_payment_settings: ${error.message}` }, 500);

  return json({ ok: true, settings: await readSettings(admin, placeId) });
});

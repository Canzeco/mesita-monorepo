// Supabase Edge Function — business-web-redeem-premier-code
//
// MESITA-3167: whoever runs the place (owner or editor, or Mesita staff)
// redeems a Mesita Premier code on it from Business › Billing ("Have a
// code?"). A code is 100%: it adds its Refill days (2X or 5X) through
// premier_redeem_code; nothing is charged. 10 tries per user per hour,
// shared with the guest's door.
//
// Body:     { place_id: uuid, code: string }   ("7KQ2-ABCD", any case, dash optional)
// Response: { ok: true, tier: 1|2, days, ends_at, ends_at_2x, ends_at_5x, paused: { tier, until } | null }
// Refusal:  200 { ok: false, code, error, retry_after? } — code_unknown · code_expired ·
//           code_exhausted · code_used_here · paid_higher · cap_reached · rate_limited ·
//           not_found · archived · unlisted. 404 not_found for a place the caller
//           does not run. 503 codes_off (PREMIER_CODE_PEPPER unset).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { redeemPremierCode } from "../_shared/premier-code.ts";

serveJson("business-web-redeem-premier-code", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, code } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  // Owner and editor both redeem (the plan's consolidated spec): a code only adds days.
  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  return await redeemPremierCode(admin, { rawCode: code, placeId, userId: user.id }, "business-web-redeem-premier-code");
});

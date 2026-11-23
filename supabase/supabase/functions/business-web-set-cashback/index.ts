// Supabase Edge Function — business-web-set-cashback
//
// MESITA-4698: Business › Payments › Cashback. The owner sets the place's
// two cashback lines (Welcome, Returning; MESITA-4709), each Off ·
// 5 · 10 · 15 · 20 %, and the cap per bill. The owner and Mesita staff only:
// it is the place's money. Cashback is earned only while Loyalty Cards is On
// (the SQL trigger pay_tabs_grant_cashback checks); saving rates does not
// need it, so an owner can set them before signing.
//
// MESITA-4714: and Post, the Instagram story reward (story_reward_cents:
// 0 Off · 2000 · 5000; optional, absent keeps the saved one). It pays only
// while Loyalty Cards is On (story_reward_grant checks).
//
// Body: { place_id, welcome_bps, returning_bps, story_reward_cents? } (a cap_cents is ignored; no ceiling since MESITA-4728)
// Response: { ok: true, cashback: { welcome_bps, returning_bps, story_reward_cents } }
//   400 (bad input) · 403 owner_only

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { CASHBACK_RATE_COLUMNS, readCashbackInput } from "../_shared/cashback.ts";

serveJson("business-web-set-cashback", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const input = readCashbackInput(bodyRes.body);
  if (!input.ok) return json({ ok: false, code: "invalid", error: input.error }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const { data, error } = await admin
    .from("place_cashback_settings")
    .upsert({ place_id: placeId, ...input.rates, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "place_id" })
    .select(CASHBACK_RATE_COLUMNS)
    .single();
  if (error) return json({ ok: false, error: `place_cashback_settings: ${error.message}` }, 500);
  console.log("[business-web-set-cashback]", JSON.stringify({ place_id: placeId, ...input.rates, by: user.id }));
  return json({ ok: true, cashback: data });
});

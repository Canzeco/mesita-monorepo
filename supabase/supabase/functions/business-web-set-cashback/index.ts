// Supabase Edge Function — business-web-set-cashback
//
// MESITA-4698: Business › Payments › Cashback. The owner sets the place's
// two cashback lines (Welcome, Returning; MESITA-4709), each Off ·
// 5 · 10 · 15 · 20 %, and the cap per bill. The owner and Mesita staff only:
// it is the place's money. Cashback is earned only while Loyalty Cards is On
// (the SQL trigger pay_tabs_grant_cashback checks); saving rates does not
// need it, so an owner can set them before signing.
//
// MESITA-5072: two lines — Welcome 0 · 1000 · 2000 and Returning 0 · 500,
// with 1000 only where Small's bonus is 2000 (this save's or the saved one).
// The VIP lines are gone: a non-zero VIP rate is refused, both are written 0.
//
// MESITA-4764: two picks per offer, and the voucher bonuses
// small_bonus_bps 1000 · 2000, medium_bonus_bps 2000 · 4000, big_bonus_bps
// 3000 · 6000 (MESITA-4980; optional; absent keeps the saved one).
//
// Body: { place_id, welcome_bps, returning_bps, returning_vip_bps? (0 only), welcome_vip_bps? (0 only), small_bonus_bps?, medium_bonus_bps?, big_bonus_bps? } (a cap_cents is ignored; no ceiling since MESITA-4728)
// Response: { ok: true, cashback: { welcome_bps, welcome_vip_bps, returning_bps, returning_vip_bps, small_bonus_bps, medium_bonus_bps, big_bonus_bps } }
//   400 (bad input) · 403 owner_only

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { CASHBACK_RATE_COLUMNS, readCashbackInput, readCashbackRates } from "../_shared/cashback.ts";

serveJson("business-web-set-cashback", async (req) => {
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

  // What the place holds now (its row, else the defaults): Returning 10% is
  // checked against Small's bonus, and that bonus is written with the row so
  // a first save never meets the table default (MESITA-5072).
  let saved;
  try {
    saved = await readCashbackRates(admin, placeId);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
  const input = readCashbackInput(bodyRes.body, saved);
  if (!input.ok) return json({ ok: false, code: "invalid", error: input.error }, 400);
  input.rates.small_bonus_bps ??= saved.small_bonus_bps;

  const { data, error } = await admin
    .from("place_cashback_settings")
    .upsert({ place_id: placeId, ...input.rates, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "place_id" })
    .select(CASHBACK_RATE_COLUMNS)
    .single();
  if (error) return json({ ok: false, error: `place_cashback_settings: ${error.message}` }, 500);
  console.log("[business-web-set-cashback]", JSON.stringify({ place_id: placeId, ...input.rates, by: user.id }));
  return json({ ok: true, cashback: data });
});

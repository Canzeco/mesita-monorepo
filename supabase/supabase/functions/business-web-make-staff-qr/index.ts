// Supabase Edge Function — business-web-make-staff-qr
//
// MESITA-3696: "New Staff QR" on Business › Payments. Makes the place's Staff
// QR secret (32 random bytes), or replaces it: the old printout stops working
// and every staff token of the place ends, because tokens are signed over the
// code hash and this secret (_shared/staff.ts). Needs the waiter code first;
// the owner and Mesita staff only.
//
// Body: { place_id: uuid }
// Response: { ok: true, staff_qr: { secret, made_at, used_at: null, place_name } }
//   409 place_code_required (set the waiter code first)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { makeStaffQr } from "../_shared/staff.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";

serveJson("business-web-make-staff-qr", async (req) => {
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

  const secret = makeStaffQr();
  const madeAt = new Date().toISOString();
  const { data, error } = await admin
    .from("place_codes")
    .update({ staff_qr: secret, staff_qr_made_at: madeAt, staff_qr_used_at: null })
    .eq("place_id", placeId)
    .select("place_id");
  if (error) return json({ ok: false, error: `place_codes: ${error.message}` }, 500);
  if (!data || data.length === 0) {
    return json({ ok: false, code: "place_code_required", error: "Set the waiter code first" }, 409);
  }
  console.log("[business-web-make-staff-qr]", JSON.stringify({ outcome: "made", place_id: placeId }));
  const placeRes = await readVoucherPlace(admin, placeId);
  const placeName = placeRes.ok ? placeRes.place?.name ?? null : null;
  return json({ ok: true, staff_qr: { secret, made_at: madeAt, used_at: null, place_name: placeName } });
});

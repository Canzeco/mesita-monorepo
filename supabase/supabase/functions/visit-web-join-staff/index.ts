// Supabase Edge Function — visit-web-join-staff
//
// MESITA-3696: a waiter scans the place's Staff QR (printed from Business ›
// Payments) and visit.mesita.ai/staff/<place> sends its secret here once. The
// answer is the same 12-hour staff token the place code mints
// (_shared/staff.ts), so /tab and /payments read with it and never ask for
// the code on that phone. A replaced or unknown QR is a staff try.
//
// Body: { place_id: uuid, staff_qr: 43 base64url characters }
// Response: { ok: true, staff_token, staff_token_expires_at, place: { name },
//             test_mode }
//   400 (a malformed call) · 403 staff_only (no QR) | staff_qr_off (replaced
//   or unknown: one staff try) · 404 gone (no such active place) · 409
//   place_code_required | locked (+retry_after_s)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { clientAddress, staffTryKey } from "../_shared/charge.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readStaffQr, staffAccess, supabaseStaffStore } from "../_shared/staff.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("visit-web-join-staff", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const staffQr = readStaffQr(bodyRes.body.staff_qr);
  if (!staffQr) return json({ ok: false, code: "staff_only", error: "This Staff QR is not complete. Scan it again." }, 403);

  const placeRes = await readVoucherPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, code: "gone", error: "This place is not on Mesita" }, 404);
  }

  const access = await staffAccess(supabaseStaffStore(admin), {
    input: { placeId, placeCode: null, staffToken: null, staffQr },
    serviceKey: env.serviceKey,
    staffKey: await staffTryKey(env.serviceKey, clientAddress(req.headers)),
    nowMs: Date.now(),
  });
  // Never the secret or the token in a log line.
  console.log("[visit-web-join-staff]", JSON.stringify({ outcome: access.ok ? "signed_in" : access.code, place_id: placeId }));
  if (!access.ok) return json({ ok: false, code: access.code, error: access.error, ...access.detail }, access.status);
  if (!access.minted) return json({ ok: false, code: "staff_only", error: "Scan the Staff QR again" }, 403);
  return json({
    ok: true,
    staff_token: access.minted.token,
    staff_token_expires_at: access.minted.expiresAt,
    place: { name: place.name ?? null },
    test_mode: !paymentsLivemode(),
  });
});

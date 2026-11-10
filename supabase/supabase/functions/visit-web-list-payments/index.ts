// Supabase Edge Function — visit-web-list-payments
//
// MESITA-3462: the staff list of a place's Mesita Payments at
// visit.mesita.ai/payments/<place>. Staff identity is the place code
// (_shared/staff.ts): the first read carries it and answers a 12-hour staff
// token; every read after carries the token only. Changing the place code on
// Business › Payments revokes every token of the place. Never who paid.
//
// Body: { place_id: uuid, place_code: 6 digits } | { place_id, staff_token }
// Response: { ok: true, payments: [{ id, amount_cents, tip_cents, currency,
//             paid_at, ticket, seen, refunded }], place: { name },
//             server_time, test_mode, staff_token?, staff_token_expires_at? }
//   400 (a malformed call) · 403 staff_only (no key, a wrong code: one staff
//   try, a bad, stale or revoked token) · 404 gone (no such active place) ·
//   409 place_code_required | locked (+retry_after_s)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode } from "../_shared/boost.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { clientAddress, staffTryKey } from "../_shared/charge.ts";
import { listPayments, readListBody, staffAccess, supabaseStaffStore } from "../_shared/staff.ts";

serveJson("visit-web-list-payments", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readListBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, parsed.status);
  const input = parsed.input;

  const admin = adminClient(envRes.env);
  const placeRes = await readVoucherPlace(admin, input.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, code: "gone", error: "This place is not on Mesita" }, 404);
  }

  const store = supabaseStaffStore(admin);
  const nowMs = Date.now();
  const access = await staffAccess(store, {
    input,
    serviceKey: envRes.env.serviceKey,
    staffKey: await staffTryKey(envRes.env.serviceKey, clientAddress(req.headers)),
    nowMs,
  });
  if (!access.ok) {
    console.log("[visit-web-list-payments]", JSON.stringify({ outcome: access.code, place_id: input.placeId }));
    return json({ ok: false, code: access.code, error: access.error, ...access.detail }, access.status);
  }

  const livemode = paymentsLivemode();
  const payments = await listPayments(store, { placeId: input.placeId, livemode, nowMs });
  // Never the place code or the token in a log line.
  if (access.minted) console.log("[visit-web-list-payments]", JSON.stringify({ outcome: "signed_in", place_id: input.placeId }));
  return json({
    ok: true,
    payments,
    place: { name: place.name ?? null },
    server_time: new Date(nowMs).toISOString(),
    test_mode: !livemode,
    ...(access.minted ? { staff_token: access.minted.token, staff_token_expires_at: access.minted.expiresAt } : {}),
  });
});

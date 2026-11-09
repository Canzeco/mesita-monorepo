// Supabase Edge Function — visit-web-open-charge
//
// MESITA-3306 (W2c): staff open the waiter's charge at
// visit.mesita.ai/charge/<place>. No sign-in there: the place code is the
// key. The place-code gate lives here and nowhere else (gate d2): a place
// with no code answers place_code_required. The answer is a 4-digit code the
// guest types on Pay and a charge_token the staff screen polls with; both are
// stored only hashed and never logged.
//
// Body: { place_id: uuid, place_code: 6 digits, amount_cents: integer,
//         ticket?: string (at most 32, trimmed) }
// Response: { ok: true, code, charge_token, amount_cents, currency, ticket,
//             expires_at, server_time, place: { name }, test_mode }
//   400 (a malformed call) · 400 amount_required | above_cap | ticket_too_long ·
//   403 forbidden (a wrong place code: one staff try) · 404 gone (no such
//   active place) · 409 place_code_required | locked (+retry_after_s)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode } from "../_shared/boost.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { clientAddress, openCharge, readOpenChargeBody, staffTryKey, supabaseChargeStore } from "../_shared/charge.ts";

serveJson("visit-web-open-charge", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readOpenChargeBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const input = parsed.input;

  const admin = adminClient(envRes.env);
  const placeRes = await readVoucherPlace(admin, input.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
  }

  const res = await openCharge(supabaseChargeStore(admin), {
    input,
    currency: String(place.currency ?? MONEY_CURRENCY).toLowerCase(),
    staffKey: await staffTryKey(envRes.env.serviceKey, clientAddress(req.headers)),
    nowMs: Date.now(),
  });
  if (!res.ok) {
    console.log("[visit-web-open-charge]", JSON.stringify({ outcome: res.code ?? "refused", place_id: input.placeId }));
    return json({ ok: false, code: res.code, error: res.error, ...res.detail }, res.status);
  }
  // Never the code or the token in a log line.
  console.log("[visit-web-open-charge]", JSON.stringify({ outcome: "open", place_id: input.placeId, amount_cents: input.amountCents }));
  return json({ ok: true, ...res.charge, place: { name: place.name ?? null }, test_mode: !paymentsLivemode() });
});

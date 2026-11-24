// Supabase Edge Function — visit-web-sign-in
//
// MESITA-4823 (waiter-led pay): a waiter's phone becomes staff of one place
// with the waiter code, once per 12 hours. Without a code it answers the
// place's name, for the screen that asks for it.
//
// Body: { place_id, place_code?: 4 digits }
// Response: { ok: true, place: { id, name }, has_code,
//             staff_token?, staff_expires_at? }
//   400 · 403 staff_only (a wrong code: one staff try) · 404 gone ·
//   409 place_code_required | locked (+retry_after_s)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { clientAddress, staffTryKey } from "../_shared/charge.ts";
import { readListBody, staffAccess, supabaseStaffStore } from "../_shared/staff.ts";

serveJson("visit-web-sign-in", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readListBody({ place_id: bodyRes.body.place_id, place_code: bodyRes.body.place_code });
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
  const input = parsed.input;

  try {
    const placeRes = await readVoucherPlace(admin, input.placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes.place;
    if (!place || place.state !== "active") {
      return json({ ok: false, code: "gone", error: "This place is not on Mesita" }, 404);
    }
    const store = supabaseStaffStore(admin);
    const answer = { ok: true, place: { id: input.placeId, name: place.name ?? null } };
    if (bodyRes.body.place_code === undefined) {
      return json({ ...answer, has_code: (await store.keys(input.placeId)) !== null });
    }
    const access = await staffAccess(store, {
      input,
      serviceKey: env.serviceKey,
      staffKey: await staffTryKey(env.serviceKey, clientAddress(req.headers)),
      nowMs: Date.now(),
    });
    console.log("[visit-web-sign-in]", JSON.stringify({ outcome: access.ok ? "signed_in" : access.code, place_id: input.placeId }));
    if (!access.ok) {
      const error = access.code === "staff_only" ? "That waiter code is not right" : access.error;
      return json({ ok: false, code: access.code, error, ...access.detail }, access.status);
    }
    return json({ ...answer, has_code: true, staff_token: access.minted?.token ?? null, staff_expires_at: access.minted?.expiresAt ?? null });
  } catch (err) {
    return failWithRequestId("visit-web-sign-in", "Couldn't sign in. Try again.", err);
  }
});

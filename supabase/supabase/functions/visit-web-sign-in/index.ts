// Supabase Edge Function — visit-web-sign-in
//
// MESITA-4827: the waiter types the place's 6-digit code on a bill. The code
// alone names the place (place_codes.lookup_hash); no phone is set up and
// nothing about it is remembered. Answers a staff token of that place, which
// the bill's own calls carry.
//
// A try needs the guest's live QR, or a bill (MESITA-4833): the code alone can't
// be guessed from outside a table. waiter_code_try counts the wrong ones.
//
// Body: { code: 6 digits, token | bill_id }
// Response: { ok: true, place: { id, name }, staff_token }
//   400 bad_request · 403 staff_only (a wrong code) · 404 code_gone (the QR) ·
//   409 locked (+retry_after_s; five wrong codes on one guest, or thirty from
//   one address, in ten minutes)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { clientAddress, staffTryKey } from "../_shared/charge.ts";
import { callTabRpc } from "../_shared/tab.ts";
import { hashPayCode, readSignInBy } from "../_shared/pay-bill.ts";
import { lookupPlaceCode, readPlaceCode } from "../_shared/place-code.ts";
import { mintStaffToken, supabaseStaffStore } from "../_shared/staff.ts";

serveJson("visit-web-sign-in", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = readPlaceCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "bad_request", error: "Type the 6-digit code" }, 400);
  const by = readSignInBy(bodyRes.body);
  if (!by) return json({ ok: false, code: "bad_request", error: "Scan the guest's QR again" }, 400);

  try {
    const nowMs = Date.now();
    const r = await callTabRpc(admin, "waiter_code_try", {
      p_token_hash: by.kind === "token" ? await hashPayCode(by.token) : null,
      p_bill_id: by.kind === "bill" ? by.billId : null,
      p_addr_hash: await staffTryKey(env.serviceKey, clientAddress(req.headers)),
      p_lookup_hash: await lookupPlaceCode(env.serviceKey, code),
    });
    if (r.ok !== true) {
      console.log("[visit-web-sign-in]", JSON.stringify({ outcome: r.code }));
      if (r.code === "locked") return json({ ok: false, code: "locked", error: "Too many wrong codes. Wait a few minutes.", retry_after_s: r.retry_after_s }, 409);
      if (r.code === "code_gone") return json({ ok: false, code: "code_gone", error: "That QR expired. Scan the guest's QR again." }, 404);
      return json({ ok: false, code: "staff_only", error: "That code is not right" }, 403);
    }
    const placeId = String(r.place_id);
    const placeRes = await readVoucherPlace(admin, placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes.place;
    const keys = await supabaseStaffStore(admin).keys(placeId);
    if (!place || !keys) throw new Error("sign_in: place or keys gone");
    const minted = await mintStaffToken(env.serviceKey, placeId, keys, nowMs, "code");
    console.log("[visit-web-sign-in]", JSON.stringify({ outcome: "ok", place_id: placeId }));
    return json({ ok: true, place: { id: placeId, name: place.name ?? null }, staff_token: minted.token });
  } catch (err) {
    return failWithRequestId("visit-web-sign-in", "Couldn't check the code. Try again.", err);
  }
});

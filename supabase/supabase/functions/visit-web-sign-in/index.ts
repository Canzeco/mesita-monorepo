// Supabase Edge Function — visit-web-sign-in
//
// MESITA-4904: the place's one 6-digit code, typed on each bill, at the place of
// the guest's QR or the bill; nothing about the phone is remembered. With it, the
// waiter's name when the owner asks for one: it is inside the token, which the
// bill's own calls carry, and it proves nothing about who typed it.
//
// A try needs the guest's live QR, or a bill (MESITA-4833): the code alone can't
// be guessed from outside a table. waiter_code_try counts the wrong ones.
//
// Without `code` (MESITA-4890): a Discount place that turned codes off, named by
// the page the guest opened their QR on, answers the same token.
//
// Body: { code?: 6 digits, name?, token | bill_id }
// Response: { ok: true, place: { id, name }, waiter: { name }, staff_token }
//   400 bad_request · 403 staff_only (a wrong code) |
//       code_needed (+name_required) · 400 name_needed (no code was tried) ·
//   409 ticket_closed (the third wrong code on this QR or bill, MESITA-4898) |
//       place_needed (the QR was opened on no place) · 404 code_gone (the QR) ·
//   409 locked (+retry_after_s; per guest or per address, for ten minutes or a
//   day, waiter_code_try)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { clientAddress, staffTryKey } from "../_shared/charge.ts";
import { callTabRpc } from "../_shared/tab.ts";
import { hashPayCode, readSignInBy } from "../_shared/pay-bill.ts";
import { mintWaiterToken, readWaiter, readWaiterCode, readWaiterName, WAITER_NAME_MAX } from "../_shared/waiter-code.ts";

serveJson("visit-web-sign-in", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = readWaiterCode(bodyRes.body.code);
  const without = bodyRes.body.code === undefined;
  if (!code && !without) return json({ ok: false, code: "bad_request", error: "Type the 6-digit code" }, 400);
  const by = readSignInBy(bodyRes.body);
  if (!by) return json({ ok: false, code: "bad_request", error: "Scan the guest's QR again" }, 400);

  const name = readWaiterName(bodyRes.body.name);

  try {
    const nowMs = Date.now();
    const tokenHash = by.kind === "token" ? await hashPayCode(by.token) : null;
    const billId = by.kind === "bill" ? by.billId : null;
    const asks = async () => {
      const { data, error } = await admin.rpc("waiter_name_required", { p_token_hash: tokenHash, p_bill_id: billId });
      if (error) throw new Error(`waiter_name_required: ${error.message}`);
      return data === true;
    };
    if (!code) {
      const { data, error } = await admin.rpc("waiter_no_code", { p_token_hash: tokenHash, p_bill_id: billId });
      if (error) throw new Error(`waiter_no_code: ${error.message}`);
      const row = typeof data === "string" ? await readWaiter(admin, data) : null;
      if (!row) return json({ ok: false, code: "code_needed", name_required: await asks(), error: "Type the 6-digit code" }, 403);
      const at = await readVoucherPlace(admin, row.placeId);
      if (!at.ok) throw new Error(at.error);
      console.log("[visit-web-sign-in]", JSON.stringify({ outcome: "no_code", place_id: row.placeId }));
      return json({ ok: true, place: { id: row.placeId, name: at.place?.name ?? null }, waiter: null, staff_token: await mintWaiterToken(env.serviceKey, row, null, nowMs) });
    }
    const required = await asks();
    if (required && !name) {
      return json({ ok: false, code: "name_needed", error: `Type your name, up to ${WAITER_NAME_MAX} characters.` }, 400);
    }
    const r = await callTabRpc(admin, "waiter_code_try", {
      p_token_hash: tokenHash,
      p_bill_id: billId,
      p_addr_hash: await staffTryKey(env.serviceKey, clientAddress(req.headers)),
      p_code: code,
    });
    if (r.ok !== true) {
      console.log("[visit-web-sign-in]", JSON.stringify({ outcome: r.code }));
      if (r.code === "locked") {
        // A day's lock can have hours left: say them, never "a few minutes".
        const wait = Number(r.retry_after_s) || 0;
        const hours = Math.ceil(wait / 3600);
        const when = wait <= 600 ? "Wait a few minutes." : wait <= 3600 ? "Try again in an hour." : `Try again in ${hours} hours.`;
        return json({ ok: false, code: "locked", error: `Too many wrong codes. ${when}`, retry_after_s: r.retry_after_s }, 409);
      }
      if (r.code === "place_needed") return json({ ok: false, code: "place_needed", error: "Ask the guest to open Pay on your place, then scan again." }, 409);
      if (r.code === "code_gone") return json({ ok: false, code: "code_gone", error: "That QR expired. Scan the guest's QR again." }, 404);
      if (r.code === "ticket_closed") return json({ ok: false, code: "ticket_closed", error: "Too many wrong codes. This ticket is closed." }, 409);
      const left = typeof r.left === "number" && r.left > 0 ? ` ${r.left} ${r.left === 1 ? "try" : "tries"} left.` : "";
      return json({ ok: false, code: "staff_only", error: `That code is not right for the place the guest opened.${left}` }, 403);
    }
    const placeId = String(r.place_id);
    const placeRes = await readVoucherPlace(admin, placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes.place;
    const waiter = await readWaiter(admin, String(r.waiter_id));
    if (!place || !waiter) throw new Error("sign_in: place or waiter gone");
    const token = await mintWaiterToken(env.serviceKey, waiter, required ? name : null, nowMs);
    console.log("[visit-web-sign-in]", JSON.stringify({ outcome: "ok", place_id: placeId }));
    return json({ ok: true, place: { id: placeId, name: place.name ?? null }, waiter: required ? { name } : null, staff_token: token });
  } catch (err) {
    return failWithRequestId("visit-web-sign-in", "Couldn't check the code. Try again.", err);
  }
});

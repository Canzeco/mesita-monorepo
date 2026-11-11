// Supabase Edge Function — visit-web-verify-tab
//
// MESITA-3707 (guest pays, waiter verifies): the waiter scanned the guest's
// QR (visit.mesita.ai/tab/<token>) and taps Verify. Only a phone signed in by
// the owner's Staff QR may verify: its staff token must be an `s2…qr` token
// of the tab's place (_shared/staff.ts). A token minted by the place code
// answers staff_qr_needed: a code can be watched being typed at the table.
// pay_tab_verify does the rest under the pair lock: cash is confirmed with the
// shortfall rules and its 2% cashback written; a tab paid in the app is only
// stamped; a second Verify moves no money; a card still going through waits.
// The phone that verified is kept as a hash of its device id, never the token.
//
// Body: { token: the tab's QR token, place_id: the staff token's place,
//         staff_token, cash_received_cents? (empty = exactly what is owed) }
// Response: { ok: true, outcome: verified | already_verified, verified_at,
//             same_phone?, cash_received_cents?, cash_tip_cents?,
//             cashback_cents? }
//   400 bad_request | amount_required · 403 staff_qr_needed | forbidden ·
//   404 gone · 409 short (+missing_cents) | card_pending | expired |
//   cancelled | not_paid

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { MAX_PAYMENT_INPUT_CENTS } from "../_shared/money.ts";
import { readStaffToken, staffDeviceHash, supabaseStaffStore } from "../_shared/staff.ts";
import { callTabRpc, isTabToken, readTabByToken, rpcRefusal } from "../_shared/tab.ts";

serveJson("visit-web-verify-tab", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { token, place_id: placeId, staff_token: staffToken, cash_received_cents: received } = bodyRes.body;
  if (!isTabToken(token)) return json({ ok: false, code: "bad_request", error: "That is not a guest's payment" }, 400);
  if (!isUuid(placeId)) return json({ ok: false, code: "bad_request", error: "place_id must be a Mesita place id" }, 400);
  if (typeof staffToken !== "string" || staffToken.length > 128) {
    return json({ ok: false, code: "staff_qr_needed", error: "Scan your Staff QR" }, 403);
  }
  if (received !== undefined && received !== null
      && (typeof received !== "number" || !Number.isInteger(received) || received < 0 || received > MAX_PAYMENT_INPUT_CENTS)) {
    return json({ ok: false, code: "amount_required", error: "Type the cash you received" }, 400);
  }

  try {
    const keys = await supabaseStaffStore(admin).keys(placeId);
    const info = await readStaffToken(env.serviceKey, placeId, staffToken, keys, Date.now());
    if (!info || info.src !== "qr" || !info.jti) {
      console.log("[visit-web-verify-tab]", JSON.stringify({ outcome: "staff_qr_needed", place_id: placeId, version: info?.version ?? null }));
      return json({ ok: false, code: "staff_qr_needed", error: "Scan your Staff QR" }, 403);
    }
    const tab = await readTabByToken(admin, token);
    if (!tab || tab.origin !== "guest") {
      return json({ ok: false, code: "gone", error: "Scan the guest's screen again." }, 404);
    }
    if (tab.place_id !== placeId) {
      return json({ ok: false, code: "forbidden", error: "This payment is for another place." }, 403);
    }

    const r = await callTabRpc(admin, "pay_tab_verify", {
      p_tab_id: tab.id,
      p_place_id: placeId,
      p_staff_key_hash: await staffDeviceHash(info.jti),
      p_received_cents: typeof received === "number" ? received : null,
    });
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[visit-web-verify-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    // Never a token or the device id in a log line.
    console.log("[visit-web-verify-tab]", JSON.stringify({
      outcome: r.outcome,
      tab_id: tab.id,
      place_id: placeId,
      cashback_cents: r.cashback_cents ?? 0,
      same_phone: r.same_phone ?? null,
    }));
    return json({
      ok: true,
      outcome: r.outcome,
      verified_at: r.verified_at ?? null,
      same_phone: r.same_phone ?? null,
      cash_received_cents: r.cash_received_cents ?? null,
      cash_tip_cents: r.cash_tip_cents ?? null,
      cashback_cents: r.cashback_cents ?? 0,
    });
  } catch (err) {
    return failWithRequestId("visit-web-verify-tab", "Couldn't verify. Try again.", err);
  }
});

// Supabase Edge Function — visit-web-reject-tab
//
// MESITA-3843 (Payments Flow Guest-Lead, W1a): the waiter scanned the guest's
// QR and taps Reject because the amount is wrong. The same staff gate as
// visit-web-verify-tab (a current `s2` staff token of the bill's place);
// pay_tab_reject does the rest under the pair lock: the bill's open rows
// expire (nothing held stays held, no credit is spent) and the bill ends
// cancelled with end_reason rejected. A second Reject moves nothing.
//
// Body: { token: the tab's QR token, place_id: the staff token's place, staff_token }
// Response: { ok: true, outcome: rejected | already_rejected }
//   400 bad_request · 403 staff_code_needed | forbidden · 404 gone ·
//   409 verified | card_pending | paid_part | expired | cancelled | paid

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readStaffToken, staffDeviceHash, supabaseStaffStore } from "../_shared/staff.ts";
import { callTabRpc, isTabToken, readTabByToken, rpcRefusal } from "../_shared/tab.ts";

serveJson("visit-web-reject-tab", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { token, place_id: placeId, staff_token: staffToken } = bodyRes.body;
  if (!isTabToken(token)) return json({ ok: false, code: "bad_request", error: "That is not a guest's payment" }, 400);
  if (!isUuid(placeId)) return json({ ok: false, code: "bad_request", error: "place_id must be a Mesita place id" }, 400);
  if (typeof staffToken !== "string" || staffToken.length > 128) {
    return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
  }

  try {
    const keys = await supabaseStaffStore(admin).keys(placeId);
    const info = await readStaffToken(env.serviceKey, placeId, staffToken, keys, Date.now());
    if (!info || !info.jti) {
      return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
    }
    const tab = await readTabByToken(admin, token);
    if (!tab || tab.origin !== "guest") {
      return json({ ok: false, code: "gone", error: "Scan the guest's screen again." }, 404);
    }
    if (tab.place_id !== placeId) {
      return json({ ok: false, code: "forbidden", error: "This payment is for another place." }, 403);
    }

    const r = await callTabRpc(admin, "pay_tab_reject", {
      p_tab_id: tab.id,
      p_place_id: placeId,
      p_staff_key_hash: await staffDeviceHash(info.jti),
    });
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[visit-web-reject-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    // [pay-tab]: never a token or the device id in a log line.
    console.log("[pay-tab]", JSON.stringify({ tab_id: tab.id, place_id: placeId, to: "cancelled", reason: "rejected", outcome: r.outcome }));
    return json({ ok: true, outcome: r.outcome });
  } catch (err) {
    return failWithRequestId("visit-web-reject-tab", "Couldn't reject. Try again.", err);
  }
});

// Supabase Edge Function — consumer-web-open-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): a signed-in guest opens a
// tab at a place and shows its QR to the waiter. One open tab per guest per
// place: opening again reuses it; while it still waits for the bill its QR
// rotates (only the newest works), after that no QR is needed.
//
// Body: { place_id: uuid }
// Response: { ok: true, tab_id, outcome: opened | reused, status,
//             token (null when the tab is already billed), qr_url | null,
//             expires_at, test_mode }
//   400 (a malformed call) · 401 sign_in · 404 gone (no such active place)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { callTabRpc, hashTabToken, mintTabToken, tabUrl } from "../_shared/tab.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("consumer-web-open-tab", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  try {
    const placeRes = await readVoucherPlace(admin, placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    if (!placeRes.place || placeRes.place.state !== "active") {
      return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
    }
    const token = mintTabToken();
    const livemode = paymentsLivemode();
    const r = await callTabRpc(admin, "pay_tab_open", {
      p_consumer_id: user.id,
      p_place_id: placeId,
      p_token_hash: await hashTabToken(token),
      p_currency: String(placeRes.place.currency ?? MONEY_CURRENCY).toLowerCase(),
      p_livemode: livemode,
    });
    const rotated = r.token_rotated === true;
    console.log("[consumer-web-open-tab]", JSON.stringify({ outcome: r.outcome, tab_id: r.tab_id, place_id: placeId }));
    return json({
      ok: true,
      tab_id: r.tab_id,
      outcome: r.outcome,
      status: r.status,
      token: rotated ? token : null,
      qr_url: rotated ? tabUrl(token) : null,
      expires_at: r.expires_at,
      test_mode: !livemode,
    });
  } catch (err) {
    return failWithRequestId("consumer-web-open-tab", "Couldn't open the tab. Try again.", err);
  }
});

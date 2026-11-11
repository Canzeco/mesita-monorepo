// Supabase Edge Function — consumer-web-join-tab
//
// MESITA-3695 (Pay at the table, _shared/tab.ts): a friend scanned the
// table's join QR (/pay/join/<token> in the app) and takes a share: the
// equal part of the bill, never more than what is left unclaimed. A guest who
// already holds a share of this table gets it back. The app then opens the
// share (/pay/tab/<share_tab_id>), where it can change the amount and pays
// it like any bill.
//
// Body: { join_token: 22 base64url chars }
// Response: { ok: true, outcome: joined | reused, share_tab_id, share_cents? }
//   400 (not a token) · 401 sign_in · 404 not_found · 409 nothing_left |
//   expired | paid

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { callTabRpc, hashJoinToken, hashTabToken, isTabToken, mintTabToken, rpcRefusal } from "../_shared/tab.ts";

serveJson("consumer-web-join-tab", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay your share" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.join_token;
  if (!isTabToken(token)) return json({ ok: false, code: "not_found", error: "This bill is gone" }, 400);

  try {
    const r = await callTabRpc(admin, "pay_tab_join", {
      p_join_token_hash: await hashJoinToken(token),
      p_consumer_id: user.id,
      p_share_token_hash: await hashTabToken(mintTabToken()),
    });
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[consumer-web-join-tab]", JSON.stringify({ outcome: refusal.code }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    console.log("[consumer-web-join-tab]", JSON.stringify({ outcome: r.outcome, tab_id: r.tab_id, share_tab_id: r.share_tab_id }));
    return json({ ok: true, outcome: r.outcome, share_tab_id: r.share_tab_id, share_cents: r.share_cents ?? null });
  } catch (err) {
    return failWithRequestId("consumer-web-join-tab", "Couldn't open the bill. Try again.", err);
  }
});

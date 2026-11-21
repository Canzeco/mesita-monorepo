// Supabase Edge Function — consumer-web-cancel-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest cancels a tab
// before paying (mode "cancel"), or changes how to pay after choosing cash
// and before the waiter's Received (mode "change": the cash part is
// cancelled, the credit it held is free again, the tab is billed again with
// the same bill version).
//
// MESITA-3772: mode "close" ends the guest's own guest payment: cancelled
// when nothing moved yet, else closed now (the cash part expires, the credit
// declared with it is spent; the window-end rule, run early).
// A signed payment answers 409 verified; a card still going through answers
// 409 card_pending. "cancel" on a guest payment where money moved answers
// 409 paid_part.
//
// MESITA-4524: `tab_id` may be a guest pay attempt (a ticket not yet
// closed): "cancel" and "close" end it cancelled (its hold let go first);
// once the waiter confirmed it answers 409 charging.
//
// Body: { tab_id: uuid, mode: "cancel" | "change" | "close" }
// Response: { ok: true, outcome: cancelled | billed | closed, bill_version? }
//   400 (a malformed call) · 401 sign_in · 404 not_found ·
//   409 paying | paid | paid_part | expired | waiting_bill | billed |
//   verified | card_pending | guest_tab | not_guest

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { callTabRpc, rpcRefusal } from "../_shared/tab.ts";
import { cancelReleasedHolds } from "../_shared/settle-payment.ts";
import { paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { endAttempt, readAttemptById } from "../_shared/guest-attempt.ts";

serveJson("consumer-web-cancel-tab", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { tab_id: tabId, mode } = bodyRes.body;
  if (!isUuid(tabId)) return json({ ok: false, error: "tab_id must be a tab id" }, 400);
  if (mode !== "cancel" && mode !== "change" && mode !== "close") {
    return json({ ok: false, error: "mode is cancel, change or close" }, 400);
  }

  try {
    const attempt = await readAttemptById(admin, tabId);
    if (attempt && attempt.consumer_id === user.id && !attempt.tab_id) {
      const k = paymentsStripeKey();
      const ended = await endAttempt(admin, k ? stripeClient(k) : null, attempt.id, "cancelled", { consumerId: user.id, source: "consumer-web-cancel-tab" });
      if (ended.ok) return json({ ok: true, outcome: "cancelled", bill_version: null });
      if (ended.code === "charging") return json({ ok: false, code: "charging", error: "The waiter already confirmed. Your card is being charged." }, 409);
      if (ended.code === "already_final") return json({ ok: false, code: "verified", error: "This bill is already paid." }, 409);
      if (ended.code === "pending") return json({ ok: false, code: "card_pending", error: "Your bank is still answering. Try again in a moment." }, 409);
      return json({ ok: false, code: "not_found", error: "This bill is gone" }, 404);
    }
    const r = await callTabRpc(admin, "pay_tab_change", {
      p_tab_id: tabId,
      p_consumer_id: user.id,
      p_mode: mode,
    });
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    console.log("[consumer-web-cancel-tab]", JSON.stringify({ outcome: r.outcome, tab_id: tabId }));
    // MESITA-3856: a held card lets go now (the cron is the backstop).
    const key = paymentsStripeKey();
    if (key) {
      await cancelReleasedHolds(admin, stripeClient(key), tabId).catch((err) =>
        console.error("[consumer-web-cancel-tab] hold_cancel", String(err))
      );
    }
    return json({ ok: true, outcome: r.outcome, bill_version: r.bill_version ?? null });
  } catch (err) {
    return failWithRequestId("consumer-web-cancel-tab", "Couldn't cancel. Try again.", err);
  }
});

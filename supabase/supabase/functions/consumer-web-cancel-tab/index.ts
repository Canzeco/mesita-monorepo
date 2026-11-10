// Supabase Edge Function — consumer-web-cancel-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest cancels a tab
// before paying (mode "cancel"), or changes how to pay after choosing cash
// and before the waiter's Received (mode "change": the cash part is
// cancelled, the credit it held is free again, the tab is billed again with
// the same bill version).
//
// Body: { tab_id: uuid, mode: "cancel" | "change" }
// Response: { ok: true, outcome: cancelled | billed, bill_version? }
//   400 (a malformed call) · 401 sign_in · 404 not_found ·
//   409 paying | paid | paid_part | expired | waiting_bill | billed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { callTabRpc, rpcRefusal } from "../_shared/tab.ts";

serveJson("consumer-web-cancel-tab", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { tab_id: tabId, mode } = bodyRes.body;
  if (!isUuid(tabId)) return json({ ok: false, error: "tab_id must be a tab id" }, 400);
  if (mode !== "cancel" && mode !== "change") return json({ ok: false, error: "mode is cancel or change" }, 400);

  try {
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
    return json({ ok: true, outcome: r.outcome, bill_version: r.bill_version ?? null });
  } catch (err) {
    return failWithRequestId("consumer-web-cancel-tab", "Couldn't cancel. Try again.", err);
  }
});

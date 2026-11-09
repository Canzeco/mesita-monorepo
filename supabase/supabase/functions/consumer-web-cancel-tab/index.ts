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
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { callTabRpc, rpcRefusal } from "../_shared/tab.ts";
import { errorMessage } from "../_shared/errors.ts";

serveJson("consumer-web-cancel-tab", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to pay" }, 401);
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { tab_id: tabId, mode } = bodyRes.body;
  if (!isUuid(tabId)) return json({ ok: false, error: "tab_id must be a tab id" }, 400);
  if (mode !== "cancel" && mode !== "change") return json({ ok: false, error: "mode is cancel or change" }, 400);

  try {
    const r = await callTabRpc(adminClient(envRes.env), "pay_tab_change", {
      p_tab_id: tabId,
      p_consumer_id: authRes.user.id,
      p_mode: mode,
    });
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    console.log("[consumer-web-cancel-tab]", JSON.stringify({ outcome: r.outcome, tab_id: tabId }));
    return json({ ok: true, outcome: r.outcome, bill_version: r.bill_version ?? null });
  } catch (err) {
    const request_id = crypto.randomUUID();
    console.error("[consumer-web-cancel-tab]", JSON.stringify({ request_id, error: errorMessage(err) }));
    return json({ ok: false, error: "Couldn't cancel. Try again.", request_id }, 500);
  }
});

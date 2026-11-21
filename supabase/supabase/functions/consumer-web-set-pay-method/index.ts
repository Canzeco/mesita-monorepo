// Supabase Edge Function — consumer-web-set-pay-method
//
// MESITA-4502: the Pay tab's one saved way. card, apple_pay, or google_pay.
// Writes only the signed-in consumer. Cash is not a stored method.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { callTabRpc } from "../_shared/tab.ts";

const METHODS = new Set(["card", "apple_pay", "google_pay"]);

serveJson("consumer-web-set-pay-method", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to choose how you pay" });
  if (ctx instanceof Response) return ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const method = bodyRes.body.pay_method;
  if (typeof method !== "string" || !METHODS.has(method)) {
    return json({ ok: false, code: "bad_method", error: "Choose a card, Apple Pay, or Google Pay." }, 400);
  }
  const r = await callTabRpc(ctx.admin, "consumer_set_pay_method", {
    p_consumer_id: ctx.user.id,
    p_method: method,
  });
  if (r.ok !== true) return json({ ok: false, code: "bad_method", error: "Choose a card, Apple Pay, or Google Pay." }, 400);
  return json({ ok: true, pay_method: r.pay_method });
});

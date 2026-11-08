// Supabase Edge Function — consumer-web-call-sign-in-code
//
// MESITA-3405. "Call me with the code" on phone sign-in: a Twilio call says
// the code Supabase Auth just texted (kept by supabase-auth-send-sms), twice,
// in Spanish for +52. Only while that code is live, 3 calls per code
// (sign_in_code_take_call). Public: the guest has no session yet; a call can
// only follow a code Auth already sent to that number.
//
// Body: { phone: "+5281…" }
// Response: { ok: true } | { ok: false, code: "invalid" | "no_code" | "call_failed", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { SIGN_IN_CODE_CALLS, signInPhone } from "../_shared/sign-in-code.ts";
import { placeCodeCall } from "../_shared/place-call-code.ts";

serveJson("consumer-web-call-sign-in-code", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const phone = signInPhone(bodyRes.body.phone);
  if (!phone) return json({ ok: false, code: "invalid", error: "That number doesn't look valid." }, 400);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const { data: code, error } = await adminClient(envRes.env).rpc("sign_in_code_take_call", {
    p_phone: phone,
    p_max: SIGN_IN_CODE_CALLS,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (typeof code !== "string" || !code) {
    return json({ ok: false, code: "no_code", error: "Ask for a new code first, then we can call you." }, 409);
  }

  const call = await placeCodeCall(phone, code, "sign_in");
  if (!call.ok) {
    console.error(JSON.stringify({ fn: "consumer-web-call-sign-in-code", outcome: "call_failed", error: call.error }));
    return json({ ok: false, code: "call_failed", error: "We couldn't call you. Use the SMS code, or try again." }, 502);
  }
  console.log(JSON.stringify({ fn: "consumer-web-call-sign-in-code", outcome: "calling", call_sid: call.sid }));
  return json({ ok: true });
});

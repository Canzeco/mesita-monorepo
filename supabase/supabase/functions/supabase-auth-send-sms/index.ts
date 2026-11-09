// Supabase Edge Function — supabase-auth-send-sms
//
// MESITA-3405, MESITA-3470. Supabase Auth's Send SMS hook: Auth makes the
// sign-in code and calls this instead of texting it itself. When the guest
// picked "Call me with the code" (consumer-web-call-sign-in-code marked the
// number in sign_in_calls), a Twilio call says it; otherwise we text it
// through the same Twilio Messaging Service Auth used. Auth still checks the
// code. Test OTP numbers never reach the hook.
//
// Caller: Supabase Auth only, signed with SEND_SMS_HOOK_SECRET (Standard
// Webhooks). Body: { user: { phone }, sms: { otp } }.
// Response: always 200: {} | { error: { http_code, message } } — Auth shows the message.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { SIGN_IN_CALL_PICK_SECONDS, sendSignInSms, signInPhone, verifyHookSignature } from "../_shared/sign-in-code.ts";
import { placeCodeCall } from "../_shared/place-call-code.ts";

// Auth reads a hook's error only from a 200: any other status becomes a bare
// "Unexpected status code returned from hook" (MESITA-3406). The real status
// rides in http_code.
function hookError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

serveJson("supabase-auth-send-sms", async (req) => {
  if (req.method !== "POST") return hookError(405, "POST only");
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  if (!secret) return hookError(500, "SMS hook is not configured");
  const raw = await req.text();
  if (!(await verifyHookSignature(secret, req.headers, raw))) return hookError(401, "Bad hook signature");

  let payload: { user?: { phone?: unknown }; sms?: { otp?: unknown } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return hookError(400, "Bad hook body");
  }
  const phone = signInPhone(payload.user?.phone);
  const code = typeof payload.sms?.otp === "string" ? payload.sms.otp : null;
  if (!phone || !code || !/^\d{4,10}$/.test(code)) return hookError(400, "Hook body has no phone or code");

  const envRes = readEFEnv();
  if (!envRes.ok) return hookError(500, "Server misconfigured");
  // Spends a fresh Call pick in one statement, so one pick makes one call.
  const pickedSince = new Date(Date.now() - SIGN_IN_CALL_PICK_SECONDS * 1000).toISOString();
  const { data: picked, error: pickErr } = await adminClient(envRes.env).from("sign_in_calls")
    .update({ requested_at: null, called_at: new Date().toISOString() })
    .eq("phone", phone)
    .gt("requested_at", pickedSince)
    .select("phone");
  if (pickErr) console.error(JSON.stringify({ fn: "supabase-auth-send-sms", outcome: "pick_read_failed", error: pickErr.message }));

  if (picked && picked.length > 0) {
    const call = await placeCodeCall(phone, code, "sign_in");
    if (!call.ok) {
      console.error(JSON.stringify({ fn: "supabase-auth-send-sms", outcome: "call_failed", error: call.error }));
      return hookError(502, "We couldn't call you. Try again, or get the code by text.");
    }
    console.log(JSON.stringify({ fn: "supabase-auth-send-sms", outcome: "calling", call_sid: call.sid }));
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const sms = await sendSignInSms(phone, code);
  if (!sms.ok) {
    console.error(JSON.stringify({ fn: "supabase-auth-send-sms", outcome: "sms_failed", error: sms.error }));
    return hookError(sms.status >= 400 && sms.status < 500 ? 422 : 502, sms.error);
  }
  console.log(JSON.stringify({ fn: "supabase-auth-send-sms", outcome: "sent", message_sid: sms.sid }));
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});

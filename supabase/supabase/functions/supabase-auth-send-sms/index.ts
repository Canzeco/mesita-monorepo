// Supabase Edge Function — supabase-auth-send-sms
//
// MESITA-3405. Supabase Auth's Send SMS hook: Auth makes the sign-in code
// and calls this instead of texting it itself. We text it through the same
// Twilio Messaging Service Auth used (MESITA-4318: the call path is gone).
// Auth still checks the code. Test OTP numbers never reach the hook.
//
// Caller: Supabase Auth only, signed with SEND_SMS_HOOK_SECRET (Standard
// Webhooks). Body: { user: { phone }, sms: { otp } }.
// Response: always 200: {} | { error: { http_code, message } } — Auth shows the message.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { readEFEnv } from "../_shared/auth.ts";
import { sendSignInSms, signInPhone, verifyHookSignature } from "../_shared/sign-in-code.ts";

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

  const sms = await sendSignInSms(phone, code);
  if (!sms.ok) {
    console.error(JSON.stringify({ fn: "supabase-auth-send-sms", outcome: "sms_failed", error: sms.error }));
    return hookError(sms.status >= 400 && sms.status < 500 ? 422 : 502, sms.error);
  }
  console.log(JSON.stringify({ fn: "supabase-auth-send-sms", outcome: "sent", message_sid: sms.sid }));
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});

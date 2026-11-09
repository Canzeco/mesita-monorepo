// Supabase Edge Function — consumer-web-call-sign-in-code
//
// MESITA-3470. "Call me with the code" on phone sign-in, chosen before any
// code exists: this marks the number (sign_in_calls), then the browser asks
// Supabase Auth for a code as usual and the Send SMS hook
// (supabase-auth-send-sms) calls instead of texting. One call per number per
// minute. Public: the guest has no session yet.
//
// Body: { phone: "+5281…" }
// Response: { ok: true } | { ok: false, code: "invalid" | "too_soon", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { SIGN_IN_CALL_GAP_SECONDS, signInPhone } from "../_shared/sign-in-code.ts";

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
  const admin = adminClient(envRes.env);

  const { data: row, error: readErr } = await admin.from("sign_in_calls").select("called_at").eq("phone", phone).maybeSingle();
  if (readErr) return json({ ok: false, error: readErr.message }, 500);
  const since = row?.called_at ? (Date.now() - new Date(row.called_at).getTime()) / 1000 : Infinity;
  if (since < SIGN_IN_CALL_GAP_SECONDS) {
    const wait = Math.ceil(SIGN_IN_CALL_GAP_SECONDS - since);
    return json({ ok: false, code: "too_soon", error: `We just called you. You can ask for another call in ${wait}s.` }, 429);
  }

  const { error } = await admin.from("sign_in_calls").upsert({ phone, requested_at: new Date().toISOString() });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
});

// Supabase Edge Function — visit-web-activate-story
//
// MESITA-3507: staff saw the guest's Instagram story at the place and tap
// Activate. wallet_activate_story writes the voucher and its bonus,
// Available now, once; a second tap (or a second phone) answers the stored
// time.
//
// Body: { token: 32 hex }
// Response: { ok: true, activated_at, already: boolean }
//   400 (not a token) · 404 gone (unknown, unpaid or refunded)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { isStoryToken } from "../_shared/story.ts";

serveJson("visit-web-activate-story", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isStoryToken(token)) return json({ ok: false, error: "That is not a Story voucher" }, 400);

  const { data, error } = await adminClient(envRes.env).rpc("wallet_activate_story", { p_token: token });
  if (error) return json({ ok: false, error: `wallet_activate_story: ${error.message}` }, 500);
  const res = data as { ok?: boolean; outcome?: string; code?: string; activated_at?: string; purchase_id?: string } | null;
  if (!res?.ok) {
    return json({ ok: false, code: "gone", error: "This Story voucher is not valid. Ask the guest to show it again." }, 404);
  }
  console.log("[visit-web-activate-story]", JSON.stringify({ purchase_id: res.purchase_id, outcome: res.outcome }));
  return json({ ok: true, activated_at: res.activated_at, already: res.outcome === "already_active" });
});

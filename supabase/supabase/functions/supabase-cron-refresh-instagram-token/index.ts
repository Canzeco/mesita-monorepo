// Supabase Edge Function — supabase-cron-refresh-instagram-token (internal)
//
// MESITA-3037: keeps the Instagram DM bot's Meta token alive. Instagram's
// long-lived user token lasts 60 days; pg_cron calls this weekly (job
// `refresh-instagram-token`), it asks Meta for a fresh one with the current
// token (the stored one, else the META_IG_ACCESS_TOKEN seed) and stores it in
// public.meta_instagram_token, which meta-instagram-receive-message reads
// first. Meta refuses a token younger than 24 h; that answer is logged and
// the stored token stays.
//
// Body: {}   →  { ok, skipped? | expiresAt }
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { pickAccessToken, readInstagramDmConfig, readRefreshAnswer } from "../_shared/instagram-dm.ts";

serveJson("supabase-cron-refresh-instagram-token", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const caller = requireInternalCaller(req, envRes.env);
  if (!caller.ok) return caller.response;

  const cfg = readInstagramDmConfig();
  if (!cfg) return json({ ok: true, skipped: "dm_off" });

  const admin = adminClient(envRes.env);
  const { data: stored, error: readErr } = await admin
    .from("meta_instagram_token")
    .select("access_token")
    .maybeSingle();
  if (readErr) return json({ ok: false, error: readErr.message }, 500);
  const current = pickAccessToken(stored?.access_token, cfg.accessToken);

  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${
      encodeURIComponent(current)
    }`,
  );
  const answer = readRefreshAnswer(res.ok ? await res.json() : null, Date.now());
  if (!answer) {
    const detail = res.ok ? "no token in answer" : (await res.text()).slice(0, 300);
    console.error("ig_token_refresh_failed", res.status, detail);
    return json({ ok: false, error: "refresh_failed", status: res.status }, 502);
  }

  const { error: writeErr } = await admin.from("meta_instagram_token").upsert({
    id: true,
    access_token: answer.accessToken,
    expires_at: answer.expiresAt,
    refreshed_at: new Date().toISOString(),
  });
  if (writeErr) return json({ ok: false, error: writeErr.message }, 500);
  console.log("ig_token_refreshed", JSON.stringify({ expiresAt: answer.expiresAt }));
  return json({ ok: true, expiresAt: answer.expiresAt });
});

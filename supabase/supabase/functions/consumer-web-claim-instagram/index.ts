// Supabase Edge Function — consumer-web-claim-instagram (product caller)
//
// Authenticated. Persists the claimed Instagram follower count (and handle
// when sent) to the consumer row. Instagram is a separate fact and grants
// nothing (MESITA-2044).
//
// Story access follows the connected handle (MESITA-909): claiming Instagram
// (persisting `instagram_handle`) unlocks the Story action for any guest.
//
// Body: { followers: number, handle?: string }
// Response: { ok: true, followers: number, handle: string | null }
//
// `handle` (when sent) is normalized (leading @ stripped, lowercased) and
// persisted to consumers.instagram_handle so the profile hero/settings can
// show @handle instead of just the follower count (MESITA-74).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { writeConsumer } from "../_shared/consumer-doc.ts";

type Body = { followers?: number; handle?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const followers = Math.trunc(Number(body.followers));
  if (!Number.isFinite(followers) || followers < 0) {
    return json({ ok: false, error: "followers must be a non-negative integer" }, 400);
  }

  let handle: string | null = null;
  if (body.handle !== undefined && body.handle !== null) {
    handle = String(body.handle).trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
      return json({ ok: false, error: "handle must be a valid Instagram username" }, 400);
    }
  }

  const admin = adminClient(envRes.env);

  const patch: Record<string, unknown> = {
    instagram_followers_count: followers,
  };
  if (handle !== null) patch.instagram_handle = handle;
  const wrote = await writeConsumer(admin, { mode: "update", id: consumerId, patch });
  if (!wrote.ok) return json({ ok: false, error: wrote.error }, 500);

  return json({ ok: true, followers, handle });
});

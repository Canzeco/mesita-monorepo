// Supabase Edge Function — consumer-web-claim-instagram (product caller)
//
// Authenticated. Persists the claimed Instagram follower count (and handle
// when sent) and then recomputes the slot from every open door
// (_shared/class-doors.ts, MESITA-972).
//
// Instagram is a SEPARATE FACT and grants nothing toward Diamond
// (MESITA-2044). The reach door this endpoint used to open — Silver at 1,000,
// Diamond at 20,000, off a self-declared count — is closed: the recompute no
// longer reads followers, and migration 20260923022245 nulled every
// classes.follower_threshold. The recompute still runs so a guest whose slot
// the old door was holding falls back to the base on their next claim.
//
// Story access follows the connected handle (MESITA-909): claiming Instagram
// (persisting `instagram_handle`) unlocks the Story action for any guest.
//
// Body: { followers: number, handle?: string }
// Response: { ok: true, tier: string, followers: number, handle: string | null,
//             doors: { influencer: false, premium, aura } }
//
// `tier` echoes the resulting EFFECTIVE class key. `handle` (when sent) is
// normalized (leading @ stripped, lowercased) and persisted to
// consumers.instagram_handle so the profile hero/settings can show @handle
// instead of just the follower count (MESITA-74).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { recomputeConsumerClass } from "../_shared/class-doors.ts";
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

  // Persist the reach-door fact (and handle when sent)…
  const patch: Record<string, unknown> = {
    instagram_followers_count: followers,
  };
  if (handle !== null) patch.instagram_handle = handle;
  const wrote = await writeConsumer(admin, { mode: "update", id: consumerId, patch });
  if (!wrote.ok) return json({ ok: false, error: wrote.error }, 500);

  // …then let the shared recompute settle the slot from every open door.
  try {
    const effective = await recomputeConsumerClass(admin, consumerId);
    return json({
      ok: true,
      tier: effective.classKey,
      followers,
      handle,
      doors: effective.doors,
    });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

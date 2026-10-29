// Supabase Edge Function — consumer-web-lookup-instagram (product caller)
//
// MESITA-3039: Me › Instagram's Connect while the DM channel is off. The
// guest types a username and says "This is my Instagram account"; this
// TRUSTS that (Pato, 2026-10-29: "you just assume is true … it's a testing
// bot"), scrapes the profile through readInstagramLookup()
// (_shared/instagram-lookup.ts, Apify) and stores it on the account:
// consumer_instagram_verify takes the handle and the SCRAPED follower count
// (off any other account that had it), and adoptInstagramAvatar copies the
// photo into consumer-avatars under the Use my Instagram photo switch.
//
// This knowingly sets aside MESITA-2461's proof rule for the testing period:
// anyone can connect any public handle. The Meta DM bot (MESITA-2579) is the
// proof and replaces this once Meta approves. The name stayed "lookup" from
// MESITA-3038's read-only emulator, because a rename is a retirement.
//
// Body: { username: string, confirmed: true }
// Response: { ok: true, source: "apify", profile, photo }
//   400 invalid_username · 400 not_confirmed · 404 profile_not_found ·
//   502 scrape · 503 unavailable (no APIFY_KEY)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  jsonError,
  readJson,
  rejectUnlessMethods,
  serveJson,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { adoptInstagramAvatar } from "../_shared/instagram-avatar.ts";
import { normalizeHandle } from "../_shared/instagram-claim.ts";
import { readInstagramLookup } from "../_shared/instagram-lookup.ts";

type Body = { username?: unknown; confirmed?: unknown };

// A photo that was not taken for one of these reasons is not an error.
const QUIET_PHOTO_REASONS = new Set([
  "no_photo",
  "photo_off",
]);

serveJson("consumer-web-lookup-instagram", async (req) => {
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
  const { body } = bodyRes;

  const username = normalizeHandle(body.username);
  if (!username) {
    return json({
      ok: false,
      error: "Enter a valid Instagram username.",
      code: "invalid_username",
    }, 400);
  }
  if (body.confirmed !== true) {
    return json({
      ok: false,
      error: "Confirm this is your Instagram account.",
      code: "not_confirmed",
    }, 400);
  }

  const provider = readInstagramLookup();
  if (!provider) {
    return json({
      ok: false,
      error: "Connecting Instagram is unavailable right now.",
      code: "unavailable",
    }, 503);
  }
  const result = await provider.lookup(username);
  if (!result.ok) {
    return result.reason === "not_found"
      ? json({
        ok: false,
        error: `We couldn’t find @${username} on Instagram.`,
        code: "profile_not_found",
      }, 404)
      : json({
        ok: false,
        error: "Couldn’t reach Instagram — try again.",
        code: "scrape",
      }, 502);
  }
  const { profile } = result;

  const admin = adminClient(envRes.env);
  const { error: verifyErr } = await admin.rpc("consumer_instagram_verify", {
    p_consumer_id: consumerId,
    p_handle: profile.username,
    p_followers: profile.followerCount,
  });
  if (verifyErr) return jsonError(verifyErr.message, 500);

  const photo = await adoptInstagramAvatar(
    admin,
    envRes.env.url,
    consumerId,
    profile.profilePictureUrl,
  );
  if (!photo.ok && !QUIET_PHOTO_REASONS.has(photo.reason)) {
    console.error("lookup-instagram photo copy failed", photo.reason);
  }
  return json({ ok: true, source: provider.source, profile, photo: photo.ok });
});

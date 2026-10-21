// Supabase Edge Function — consumer-web-claim-instagram (product caller)
//
// Authenticated. Connects an Instagram account by PROOF (MESITA-2461): the
// member puts a one-time code in their bio and the server reads it there.
// Before, this EF stored whatever handle and follower count the client sent,
// and Social showed every handle — anyone could appear as @someone_famous.
// Instagram is a separate fact and grants nothing (MESITA-2044).
//
// Body (two steps):
//   { action: "start", handle }  → { ok, handle, code }
//     Issues (or re-issues for the same handle while it is live) the code,
//     held in consumer_instagram_claims. The account's current handle, if
//     any, stays until the new one is proved.
//   { action: "check" }          → { ok, handle, followers, photo }
//     Scrapes the claimed profile (Apify). Only if the bio holds the code
//     does consumer_instagram_verify store the handle, the SCRAPED follower
//     count and instagram_verified_at, taking the handle off any other
//     account. Then the profile photo is copied into consumer-avatars and
//     becomes the avatar unless the guest uploaded one (MESITA-2578,
//     _shared/instagram-avatar.ts); `photo` says whether it did. A failed
//     copy never fails the check. Failures: 404 no_claim · 410 code_expired · 429 slow_down ·
//     422 wrong_profile | code_not_in_bio | profile_not_found · 502 scrape.
// A `followers` field in the body is ignored: the app never says the count.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { APIFY_ACTORS, runApifyActor } from "../_shared/apify.ts";
import { isDeadIgStub } from "../_shared/enrich-instagram-match.ts";
import { adoptInstagramAvatar } from "../_shared/instagram-avatar.ts";
import {
  checkWaitMs,
  claimIsLive,
  judgeProfile,
  makeClaimCode,
  normalizeHandle,
} from "../_shared/instagram-claim.ts";

type Body = { action?: string; handle?: string };

// The profile scrape is synchronous; a cold actor takes ~10–20s.
const SCRAPE_TIMEOUT_MS = 45_000;

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

  const admin = adminClient(envRes.env);
  const now = Date.now();

  if (body.action === "start") {
    const handle = normalizeHandle(body.handle);
    if (!handle) return jsonError("handle must be a valid Instagram username", 400);

    const { data: existing, error: readErr } = await admin
      .from("consumer_instagram_claims")
      .select("handle, code, created_at")
      .eq("consumer_id", consumerId)
      .maybeSingle();
    if (readErr) return jsonError(readErr.message, 500);
    // Same handle, still live: the same code, so a reload never invalidates
    // a code the member already pasted into their bio.
    if (existing && existing.handle === handle && claimIsLive(existing.created_at, now)) {
      return json({ ok: true, handle, code: existing.code });
    }

    const code = makeClaimCode();
    const { error } = await admin.from("consumer_instagram_claims").upsert({
      consumer_id: consumerId,
      handle,
      code,
      created_at: new Date(now).toISOString(),
      checked_at: null,
    });
    if (error) return jsonError(error.message, 500);
    return json({ ok: true, handle, code });
  }

  if (body.action === "check") {
    const { data: claim, error: readErr } = await admin
      .from("consumer_instagram_claims")
      .select("handle, code, created_at, checked_at")
      .eq("consumer_id", consumerId)
      .maybeSingle();
    if (readErr) return jsonError(readErr.message, 500);
    if (!claim) return json({ ok: false, error: "Start again: no code is pending.", code: "no_claim" }, 404);
    if (!claimIsLive(claim.created_at, now)) {
      return json({ ok: false, error: "That code expired. Get a new one.", code: "code_expired" }, 410);
    }
    const wait = checkWaitMs(claim.checked_at, now);
    if (wait > 0) {
      return json({
        ok: false,
        error: `Give it ${Math.ceil(wait / 1000)}s and check again.`,
        code: "slow_down",
      }, 429);
    }

    const { error: stampErr } = await admin
      .from("consumer_instagram_claims")
      .update({ checked_at: new Date(now).toISOString() })
      .eq("consumer_id", consumerId);
    if (stampErr) return jsonError(stampErr.message, 500);

    const apifyKey = Deno.env.get("APIFY_KEY")?.trim();
    if (!apifyKey) return jsonError("Instagram check is unavailable right now.", 503);
    const run = await runApifyActor<Record<string, unknown>>(
      APIFY_ACTORS.instagramProfile,
      { usernames: [claim.handle] },
      apifyKey,
      SCRAPE_TIMEOUT_MS,
    );
    if (run.error || !run.items) {
      console.error("claim-instagram scrape failed", run.status, run.error);
      return json({ ok: false, error: "Couldn’t reach Instagram — try again.", code: "scrape" }, 502);
    }
    const profile = run.items[0];
    if (!profile || isDeadIgStub(profile)) {
      return json({
        ok: false,
        error: `We couldn’t find @${claim.handle} on Instagram.`,
        code: "profile_not_found",
      }, 422);
    }

    const verdict = judgeProfile(profile, claim);
    if (!verdict.ok) {
      const error = verdict.error === "wrong_profile"
        ? `We couldn’t find @${claim.handle} on Instagram.`
        : `${claim.code} isn’t in @${claim.handle}’s bio yet.`;
      return json({ ok: false, error, code: verdict.error }, 422);
    }

    const { error: verifyErr } = await admin.rpc("consumer_instagram_verify", {
      p_consumer_id: consumerId,
      p_handle: claim.handle,
      p_followers: verdict.followers,
    });
    if (verifyErr) return jsonError(verifyErr.message, 500);

    const photo = await adoptInstagramAvatar(admin, envRes.env.url, consumerId, profile, now);
    if (!photo.ok && photo.reason !== "uploaded_photo_kept" && photo.reason !== "no_photo") {
      console.error("claim-instagram photo copy failed", photo.reason);
    }
    return json({ ok: true, handle: claim.handle, followers: verdict.followers, photo: photo.ok });
  }

  return jsonError('action must be "start" or "check"', 400);
});

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
//
// BY DM (MESITA-2575), once the Meta secrets are set (readInstagramDmConfig):
//   { action: "channel" }        → { ok, channel: "dm", account, link } | { ok, channel: "bio" }
//   { action: "start_dm" }       → { ok, code, account, link, issuedAt }
//     A DM claim has no handle: the guest sends the code to Mesita's
//     Instagram and meta-instagram-receive-message learns the handle,
//     followers and photo from Meta. Re-issues the same code while it is
//     live. 409 dm_unavailable while the DM channel is off.
//   { action: "dm_status" }      → { ok, pending, handle, verifiedAt }
//     The app polls this until the claim is spent (pending false) and the
//     account's verifiedAt is at or after the code's issuedAt.
//
// DISCONNECT (MESITA-3052, Pato: "enable to disconnect account too … easy
// switch to disconnect account to switch account"):
//   { action: "disconnect" }     → { ok }
//     Clears the handle, follower count and verified time and takes down a
//     picture copied from Instagram (an upload stays, as when the photo
//     switch goes off), through consumer-doc's disconnectInstagram. A
//     pending claim is left to expire. The app asks to confirm first.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { APIFY_ACTORS, runApifyActor } from "../_shared/apify.ts";
import { isDeadIgStub } from "../_shared/enrich-instagram-match.ts";
import { adoptInstagramAvatar, pickProfilePicUrl } from "../_shared/instagram-avatar.ts";
import {
  checkWaitMs,
  claimIsLive,
  judgeProfile,
  makeClaimCode,
  normalizeHandle,
} from "../_shared/instagram-claim.ts";
import { dmLink, readInstagramDmConfig } from "../_shared/instagram-dm.ts";
import { disconnectInstagram, readInstagramStatus } from "../_shared/consumer-doc.ts";

type Body = { action?: string; handle?: string };

// A photo that was not taken for one of these reasons is not an error.
const QUIET_PHOTO_REASONS = new Set(["no_photo", "photo_off"]);

// The profile scrape is synchronous; a cold actor takes ~10–20s.
const SCRAPE_TIMEOUT_MS = 45_000;

serveJson("consumer-web-claim-instagram", async (req) => {
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

  if (body.action === "channel") {
    const dm = readInstagramDmConfig();
    return json(
      dm
        ? { ok: true, channel: "dm", account: dm.username, link: dmLink(dm.username) }
        : { ok: true, channel: "bio" },
    );
  }

  if (body.action === "disconnect") {
    const res = await disconnectInstagram(admin, consumerId);
    if (!res.ok) return jsonError(res.error, 500);
    return json({ ok: true });
  }

  if (body.action === "start_dm") {
    const dm = readInstagramDmConfig();
    if (!dm) {
      return json({
        ok: false,
        error: "Connecting by message isn’t available yet.",
        code: "dm_unavailable",
      }, 409);
    }
    const { data: existing, error: readErr } = await admin
      .from("consumer_instagram_claims")
      .select("handle, code, created_at")
      .eq("consumer_id", consumerId)
      .maybeSingle();
    if (readErr) return jsonError(readErr.message, 500);
    const account = dm.username;
    const link = dmLink(account);
    // A live DM claim keeps its code, so a reload never strands a code the
    // guest already sent.
    if (existing && existing.handle === null && claimIsLive(existing.created_at, now)) {
      return json({ ok: true, code: existing.code, account, link, issuedAt: existing.created_at });
    }
    const code = makeClaimCode();
    const issuedAt = new Date(now).toISOString();
    const { error } = await admin.from("consumer_instagram_claims").upsert({
      consumer_id: consumerId,
      handle: null,
      code,
      created_at: issuedAt,
      checked_at: null,
    });
    if (error) return jsonError(error.message, 500);
    return json({ ok: true, code, account, link, issuedAt });
  }

  if (body.action === "dm_status") {
    const [claimRes, me] = await Promise.all([
      admin.from("consumer_instagram_claims").select("handle, created_at").eq(
        "consumer_id",
        consumerId,
      ).maybeSingle(),
      readInstagramStatus(admin, consumerId),
    ]);
    if (claimRes.error) return jsonError(claimRes.error.message, 500);
    if (!me.ok) return jsonError(me.error, 500);
    const claim = claimRes.data;
    return json({
      ok: true,
      pending: Boolean(claim && claim.handle === null && claimIsLive(claim.created_at, now)),
      handle: me.handle,
      verifiedAt: me.verifiedAt,
    });
  }

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
    // A DM claim is proved by the message, not by a bio check.
    if (claim.handle === null) {
      return json({ ok: false, error: "Send the code to Mesita on Instagram.", code: "dm_claim" }, 409);
    }
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

    const photo = await adoptInstagramAvatar(
      admin,
      envRes.env.url,
      consumerId,
      pickProfilePicUrl(profile),
      now,
    );
    if (!photo.ok && !QUIET_PHOTO_REASONS.has(photo.reason)) {
      console.error("claim-instagram photo copy failed", photo.reason);
    }
    return json({ ok: true, handle: claim.handle, followers: verdict.followers, photo: photo.ok });
  }

  return jsonError('action must be "channel", "start_dm", "dm_status", "disconnect", "start" or "check"', 400);
});

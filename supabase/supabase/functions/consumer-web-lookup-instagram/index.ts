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
// MESITA-3060: `{ action: "sync" }` re-reads the CONNECTED handle (never one
// from the body) and writes the new count through consumer_instagram_sync,
// only while the account still holds that handle, so a Change account or
// Disconnect in another tab during the scrape wins. Sync never touches
// instagram_verified_at (the DM proof); it stamps instagram_synced_at.
//
// EVERY SCRAPE IS PAID, so each one first claims a slot with
// consumer_instagram_claim_scrape: 60 s between syncs, and one daily budget
// (SCRAPE_DAILY_MAX per UTC day) shared by connect and sync. Every attempt
// counts, failed scrapes included. Connecting the handle already connected
// runs the sync path.
//
// This knowingly sets aside MESITA-2461's proof rule for the testing period:
// anyone can connect any public handle. The Meta DM bot (MESITA-2579) is the
// proof and replaces this once Meta approves. The name stayed "lookup" from
// MESITA-3038's read-only emulator, because a rename is a retirement.
//
// Body: { username: string, confirmed: true }   → connect
//       { action: "sync" }                       → sync
// Response: { ok: true, result: "connected" | "synced", source, profile,
//             photo: "updated" | "off" | "failed", previousFollowers? }
//   400 invalid_action · invalid_username · not_confirmed
//   404 profile_not_found · 409 not_connected · changed
//   429 slow_down · daily_limit ({ retryAfterSeconds?, remaining?, resetsAt?, limit }, Retry-After)
//   500 sync_write_failed (+ requestId) · 502 scrape · 503 unavailable

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
  serveJson,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  adoptInstagramAvatar,
  type InstagramAvatarResult,
} from "../_shared/instagram-avatar.ts";
import { normalizeHandle } from "../_shared/instagram-claim.ts";
import {
  type InstagramProfileLookup,
  readInstagramLookup,
} from "../_shared/instagram-lookup.ts";
import { readInstagramSyncState } from "../_shared/consumer-doc.ts";

type Body = { action?: unknown; username?: unknown; confirmed?: unknown };

/** Seconds between two syncs of one account. */
const SYNC_COOLDOWN_S = 60;
/** Instagram scrapes (connect + sync) per account per UTC day. */
const SCRAPE_DAILY_MAX = 10;

// A photo that was not taken for one of these reasons is not an error.
const QUIET_PHOTO_REASONS = new Set(["no_photo", "photo_off"]);

type Claim = {
  status: "ok" | "slow_down" | "daily_limit" | "not_found";
  retry_after_s?: number;
  remaining?: number;
  resets_at?: string;
  limit?: number;
};

/** The photo outcome the app shows: Instagram links change on every scrape,
 *  so a copy is always new ("updated"); off is the guest's switch. */
function photoStatus(
  photo: InstagramAvatarResult,
): "updated" | "off" | "failed" {
  if (photo.ok) return "updated";
  if (photo.reason === "photo_off") return "off";
  if (!QUIET_PHOTO_REASONS.has(photo.reason)) {
    console.error("lookup-instagram photo copy failed", photo.reason);
  }
  return "failed";
}

function serverError(code: string, error: string, cause: string): Response {
  const requestId = crypto.randomUUID();
  console.error(`lookup-instagram ${code}`, requestId, cause);
  return json({ ok: false, error, code, requestId }, 500);
}

/** Claims one paid scrape; a Response when it is refused. */
async function claimScrape(
  admin: SupabaseClient,
  consumerId: string,
  kind: "sync" | "connect",
): Promise<Response | null> {
  const { data, error } = await admin.rpc("consumer_instagram_claim_scrape", {
    p_consumer_id: consumerId,
    p_kind: kind,
    p_cooldown_s: SYNC_COOLDOWN_S,
    p_daily_max: SCRAPE_DAILY_MAX,
  });
  if (error) {
    return serverError(
      "sync_write_failed",
      "Couldn’t save the sync.",
      error.message,
    );
  }
  const claim = data as Claim;
  if (claim.status === "ok") return null;
  if (claim.status === "not_found") {
    return json({
      ok: false,
      error: "Instagram isn’t connected.",
      code: "not_connected",
    }, 409);
  }
  const retryAfter = claim.status === "slow_down"
    ? claim.retry_after_s ?? SYNC_COOLDOWN_S
    : Math.max(
      1,
      Math.ceil((Date.parse(claim.resets_at ?? "") - Date.now()) / 1000) || 60,
    );
  const res = json({
    ok: false,
    error: claim.status === "slow_down"
      ? "Give it a minute and try again."
      : "You’ve used today’s Instagram lookups. Try again tomorrow.",
    code: claim.status,
    retryAfterSeconds: retryAfter,
    remaining: claim.remaining ?? null,
    resetsAt: claim.resets_at ?? null,
    limit: claim.limit ?? SCRAPE_DAILY_MAX,
  }, 429);
  res.headers.set("Retry-After", String(retryAfter));
  return res;
}

async function sync(
  admin: SupabaseClient,
  supabaseUrl: string,
  consumerId: string,
  provider: InstagramProfileLookup,
): Promise<Response> {
  const state = await readInstagramSyncState(admin, consumerId);
  if (!state.ok) {
    return serverError(
      "sync_write_failed",
      "Couldn’t save the sync.",
      state.error,
    );
  }
  if (!state.handle || state.deleted) {
    return json({
      ok: false,
      error: "Instagram isn’t connected.",
      code: "not_connected",
    }, 409);
  }
  const handle = state.handle;

  const refused = await claimScrape(admin, consumerId, "sync");
  if (refused) return refused;

  const result = await provider.lookup(handle);
  if (!result.ok) {
    return result.reason === "not_found"
      ? json({
        ok: false,
        error: `We couldn’t find @${handle} on Instagram anymore.`,
        code: "profile_not_found",
      }, 404)
      : json({
        ok: false,
        error: "Instagram isn’t answering right now.",
        code: "scrape",
      }, 502);
  }
  const { profile } = result;

  // Written only while the account still holds the handle read above.
  const { data: written, error } = await admin.rpc("consumer_instagram_sync", {
    p_consumer_id: consumerId,
    p_handle: handle,
    p_followers: profile.followerCount,
  });
  if (error) {
    return serverError(
      "sync_write_failed",
      "Couldn’t save the sync.",
      error.message,
    );
  }
  if (written !== true) {
    return json({
      ok: false,
      error: "Your Instagram changed. Reload.",
      code: "changed",
    }, 409);
  }

  const photo = await adoptInstagramAvatar(
    admin,
    supabaseUrl,
    consumerId,
    profile.profilePictureUrl,
  );
  return json({
    ok: true,
    result: "synced",
    source: provider.source,
    profile,
    photo: photoStatus(photo),
    previousFollowers: state.followers,
  });
}

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

  if (body.action !== undefined && body.action !== "sync") {
    return json({
      ok: false,
      error: 'action must be "sync" or absent',
      code: "invalid_action",
    }, 400);
  }

  const admin = adminClient(envRes.env);
  const provider = readInstagramLookup();

  if (body.action === "sync") {
    if (!provider) {
      return json({
        ok: false,
        error: "Syncing isn’t available right now.",
        code: "unavailable",
      }, 503);
    }
    return await sync(admin, envRes.env.url, consumerId, provider);
  }

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
  if (!provider) {
    return json({
      ok: false,
      error: "Connecting Instagram is unavailable right now.",
      code: "unavailable",
    }, 503);
  }

  // The handle already connected: that is a Sync, with its limits.
  const current = await readInstagramSyncState(admin, consumerId);
  if (current.ok && current.handle === username && !current.deleted) {
    return await sync(admin, envRes.env.url, consumerId, provider);
  }

  const refused = await claimScrape(admin, consumerId, "connect");
  if (refused) return refused;

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

  const { error: verifyErr } = await admin.rpc("consumer_instagram_verify", {
    p_consumer_id: consumerId,
    p_handle: profile.username,
    p_followers: profile.followerCount,
  });
  if (verifyErr) {
    return serverError(
      "connect_write_failed",
      "Couldn’t connect your Instagram.",
      verifyErr.message,
    );
  }

  const photo = await adoptInstagramAvatar(
    admin,
    envRes.env.url,
    consumerId,
    profile.profilePictureUrl,
  );
  return json({
    ok: true,
    result: "connected",
    source: provider.source,
    profile,
    photo: photoStatus(photo),
  });
});

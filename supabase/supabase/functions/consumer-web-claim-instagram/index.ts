// Supabase Edge Function — consumer-web-claim-instagram (product caller)
//
// Authenticated. The guest's own Instagram (MESITA-4858, Pato, 2026-11-24): add
// a handle now, unverified; prove it later with one DM. Nothing here looks the
// handle up, reads a photo or a follower count, or sends a message.
//
// Body:
//   { action: "channel" } → { ok, channel: "dm", account, link } | { ok, channel: "off" }
//     Whether verifying works: the Meta secrets are set (readInstagramDmConfig).
//   { action: "set", handle, show? } → { ok, handle, shown }
//     Saves the handle (a username, @username or profile URL) unverified. A
//     changed handle loses its badge, VIP check and code (DB trigger). `show`
//     shares it; a guest under 18 or with no birth year, a guest who chose
//     Private, or a handle another account verified, is saved hidden.
//   { action: "disconnect" } → { ok }  removes it, its link and badge.
//   { action: "start_dm", vipCheck } → { ok, code, handle, account, link, issuedAt, expiresAt }
//     A fresh 15-minute, single-use code tied to this guest and this handle.
//     vipCheck true = the guest allowed the follower check; only then does the
//     webhook ask Meta for the count. 409 no_handle · dm_unavailable.
//   { action: "dm_status" } → { ok, status: "pending" | "wrong_account" | "expired" | "none",
//                               handle, provedAt, vipStatus }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, jsonError, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { CLAIM_CODE_TTL_MS, claimIsLive, makeClaimCode, normalizeHandle } from "../_shared/instagram-claim.ts";
import { dmLink, readInstagramDmConfig } from "../_shared/instagram-dm.ts";
import { disconnectInstagram, readInstagramStatus, readSocialStanding } from "../_shared/consumer-doc.ts";
import { socialLock } from "../_shared/social-level.ts";

type Body = { action?: string; handle?: unknown; show?: unknown; vipCheck?: unknown };

serveJson("consumer-web-claim-instagram", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const consumerId = user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const now = Date.now();

  if (body.action === "channel") {
    const dm = readInstagramDmConfig();
    return json(
      dm ? { ok: true, channel: "dm", account: dm.username, link: dmLink(dm.username) } : { ok: true, channel: "off" },
    );
  }

  if (body.action === "set") {
    const handle = normalizeHandle(body.handle);
    if (!handle) {
      return json({ ok: false, error: "That isn’t an Instagram username.", code: "invalid_username" }, 400);
    }
    let show: boolean | null = typeof body.show === "boolean" ? body.show : null;
    if (show) {
      const standing = await readSocialStanding(admin, consumerId);
      if (!standing.ok) return jsonError(standing.error, 500);
      if (!standing.row || socialLock(standing.row.birth_year) || standing.row.social_private) show = false;
    }
    const { data, error } = await admin.rpc("consumer_instagram_set_handle", {
      p_consumer_id: consumerId,
      p_handle: handle,
      p_show: show,
    });
    if (error) {
      console.error("instagram_set_failed", error.message);
      return jsonError("Couldn’t save your Instagram.", 500);
    }
    return json({ ok: true, handle, shown: data === true });
  }

  if (body.action === "disconnect") {
    const res = await disconnectInstagram(admin, consumerId);
    if (!res.ok) return jsonError(res.error, 500);
    return json({ ok: true });
  }

  if (body.action === "start_dm") {
    const dm = readInstagramDmConfig();
    if (!dm) {
      return json({ ok: false, error: "Verifying isn’t available yet.", code: "dm_unavailable" }, 409);
    }
    const me = await readInstagramStatus(admin, consumerId);
    if (!me.ok) return jsonError(me.error, 500);
    if (!me.handle) return json({ ok: false, error: "Add your Instagram first.", code: "no_handle" }, 409);
    const code = makeClaimCode();
    const { error } = await admin.from("consumer_instagram_claims").upsert({
      consumer_id: consumerId,
      handle: me.handle,
      code,
      vip_check: body.vipCheck === true,
      failed_reason: null,
      created_at: new Date(now).toISOString(),
      checked_at: null,
    });
    if (error) return jsonError(error.message, 500);
    return json({
      ok: true,
      code,
      handle: me.handle,
      account: dm.username,
      link: dmLink(dm.username),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CLAIM_CODE_TTL_MS).toISOString(),
    });
  }

  if (body.action === "dm_status") {
    const [claimRes, me] = await Promise.all([
      admin.from("consumer_instagram_claims").select("created_at, failed_reason").eq("consumer_id", consumerId)
        .maybeSingle(),
      readInstagramStatus(admin, consumerId),
    ]);
    if (claimRes.error) return jsonError(claimRes.error.message, 500);
    if (!me.ok) return jsonError(me.error, 500);
    const claim = claimRes.data;
    const status = !claim
      ? "none"
      : !claimIsLive(claim.created_at, now)
      ? "expired"
      : claim.failed_reason === "wrong_account"
      ? "wrong_account"
      : "pending";
    return json({ ok: true, status, handle: me.handle, provedAt: me.provedAt, vipStatus: me.vipStatus });
  }

  return jsonError('action must be "channel", "set", "disconnect", "start_dm" or "dm_status"', 400);
});

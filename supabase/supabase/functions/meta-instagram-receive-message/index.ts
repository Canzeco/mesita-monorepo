// Supabase Edge Function — meta-instagram-receive-message (caller: Meta)
//
// MESITA-2575, MESITA-4858. Meta's Instagram messaging webhook. A guest proves
// their Instagram account by sending Mesita's account the one-time code from
// Me › Instagram; this function finds the pending claim by that code, asks
// Meta's User Profile API who sent it (the username; the follower count only
// when the guest allowed the VIP check; never a photo) and hands it to
// consumer_instagram_prove, which decides. Mesita never messages anyone first.
//
//   GET   Meta's subscribe handshake: hub.verify_token must match
//         META_IG_VERIFY_TOKEN; answers hub.challenge.
//   POST  message events, signed by Meta (X-Hub-Signature-256 with
//         META_IG_APP_SECRET). Always 200 once the signature holds, so Meta
//         does not retry; each failure is logged and, when a code was sent,
//         answered on Instagram.
//
// verify_jwt = false: Meta holds no Supabase JWT; the signature is the gate.
// Off (503) until every META_IG_* secret is set (readInstagramDmConfig).
// Calls Meta with the weekly-refreshed token in meta_instagram_token when
// there is one, else the META_IG_ACCESS_TOKEN seed (MESITA-3037).
//
// Story mentions (MESITA-4714) were removed with Instagram Stories (MESITA-4766):
// a story_mention attachment is acknowledged and ignored.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { claimIsLive } from "../_shared/instagram-claim.ts";
import {
  codeInMessage,
  DM_REPLY,
  type DmProfile,
  inboundMessages,
  type InstagramDmConfig,
  META_GRAPH_VERSION,
  pickAccessToken,
  profileFields,
  readDmProfile,
  readInstagramDmConfig,
  signatureIsValid,
  verifyHandshake,
} from "../_shared/instagram-dm.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { serveJson } from "../_shared/http.ts";

const GRAPH = `https://graph.instagram.com/${META_GRAPH_VERSION}`;

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain" } });
}

async function profileOf(cfg: InstagramDmConfig, igsid: string, vipCheck: boolean): Promise<DmProfile | null> {
  const url = `${GRAPH}/${encodeURIComponent(igsid)}?fields=${profileFields(vipCheck)}&access_token=${
    encodeURIComponent(cfg.accessToken)
  }`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("ig_profile_failed", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  return readDmProfile(await res.json(), vipCheck);
}

async function reply(cfg: InstagramDmConfig, igsid: string, message: string): Promise<void> {
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient: { id: igsid }, message: { text: message } }),
  });
  if (!res.ok) console.error("ig_reply_failed", res.status, (await res.text()).slice(0, 300));
}

async function handle(
  admin: SupabaseClient,
  cfg: InstagramDmConfig,
  senderId: string,
  code: string,
): Promise<void> {
  const { data: claim, error } = await admin
    .from("consumer_instagram_claims")
    .select("vip_check, created_at")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    console.error("ig_claim_read_failed", error.message);
    return reply(cfg, senderId, DM_REPLY.failed);
  }
  if (!claim || !claimIsLive(claim.created_at, Date.now())) {
    return reply(cfg, senderId, DM_REPLY.unknownCode);
  }

  const profile = await profileOf(cfg, senderId, claim.vip_check === true) ??
    // The count can be what Meta refused: ownership still stands alone.
    (claim.vip_check === true ? await profileOf(cfg, senderId, false) : null);
  if (!profile) return reply(cfg, senderId, DM_REPLY.failed);

  const { data: outcome, error: proveErr } = await admin.rpc("consumer_instagram_prove", {
    p_code: code,
    p_handle: profile.handle,
    p_followers: profile.followers,
    p_private: profile.isPrivate,
  });
  if (proveErr) {
    console.error("ig_prove_failed", proveErr.message);
    return reply(cfg, senderId, DM_REPLY.failed);
  }
  console.log("instagram_dm", JSON.stringify({ outcome }));
  if (outcome === "verified") return reply(cfg, senderId, DM_REPLY.verified(profile.handle));
  if (outcome === "wrong_account") return reply(cfg, senderId, DM_REPLY.wrongAccount);
  await reply(cfg, senderId, DM_REPLY.unknownCode);
}

serveJson("meta-instagram-receive-message", async (req) => {
  const cfg = readInstagramDmConfig();
  if (!cfg) return text("Instagram messaging is not set up", 503);

  if (req.method === "GET") {
    const challenge = verifyHandshake(new URL(req.url).searchParams, cfg.verifyToken);
    return challenge !== null ? text(challenge, 200) : text("Forbidden", 403);
  }
  if (req.method !== "POST") return text("Method not allowed", 405);

  const raw = await req.text();
  if (!(await signatureIsValid(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret))) {
    return text("Bad signature", 401);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const { data: stored, error: tokenErr } = await admin
    .from("meta_instagram_token")
    .select("access_token")
    .maybeSingle();
  if (tokenErr) console.error("ig_token_read_failed", tokenErr.message);
  const live = { ...cfg, accessToken: pickAccessToken(stored?.access_token, cfg.accessToken) };

  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return text("ok", 200);
  }
  for (const m of inboundMessages(body)) {
    const code = codeInMessage(m.text);
    // A message without a code is a normal DM to Mesita: no auto-reply.
    if (!code) continue;
    try {
      await handle(admin, live, m.senderId, code);
    } catch (e) {
      console.error("ig_dm_failed", e instanceof Error ? e.message : e);
    }
  }
  return text("ok", 200);
});

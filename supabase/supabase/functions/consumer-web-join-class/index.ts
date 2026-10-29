// Supabase Edge Function — consumer-web-join-class
//
// Me › Class: a Regular guest joins VIP (MESITA-2984, two ways since
// MESITA-3054). The guest always taps; nothing joins on its own.
//
// Body: { via: "code", code: "<12 digits>" } | { via: "instagram" }
//   code — EMULATED: every well-formed code is accepted (Pato, 2026-10-28:
//          "make class functional for the moment even if its an emulator").
//          Real one-use codes are MESITA-3055; this EF is where they will be
//          checked.
//   instagram — the guest's STORED handle and follower count (set when they
//          connected Instagram) must reach INSTAGRAM_REACH_FOLLOWERS (1,000,
//          _shared/instagram-reach.ts). Nothing in the body is trusted.
//
// Response: 200 { ok: true, guest_class: "vip", joined } — joined:false when
// the guest was already VIP (a retry is safe).
// Errors { ok: false, code, error, ... } — the codes are listed in Notion
// Docs › Identity (Class):
//   400 bad_request · 400 bad_code · 404 consumer_not_found ·
//   403 instagram_not_connected · 403 followers_unknown ·
//   403 not_enough_followers { followers, needed } ·
//   500 join_failed { request_id } (never the database's own words).
// Every request logs one `class_join` line {via, outcome}; a code's last four
// digits at most.
//
// The decisions live in join.ts (handleJoin), tested with no network.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
  serveJson,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { joinVipClass, readClassJoinRow } from "../_shared/consumer-doc.ts";
import { handleJoin } from "./join.ts";

serveJson("consumer-web-join-class", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const admin = adminClient(envRes.env);
  const userId = authRes.user.id;
  const res = await handleJoin(bodyRes.body, {
    readRow: () => readClassJoinRow(admin, userId),
    writeVip: (note) => joinVipClass(admin, userId, note),
    requestId: crypto.randomUUID(),
  });
  const line = JSON.stringify({ event: "class_join", ...res.log });
  if (res.log.outcome === "error") console.error(line);
  else console.log(line);
  return json(res.body, res.status);
});

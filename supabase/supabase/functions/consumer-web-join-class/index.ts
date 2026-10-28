// Supabase Edge Function — consumer-web-join-class
//
// MESITA-2984: a Regular guest joins VIP with a 12-digit code from /me/class.
//
// EMULATED (Pato, 2026-10-28: "you just input a number or whatever. but make
// class functional for the moment even if its an emulator"). Every
// well-formed code is accepted: there is no partner-code table yet. When
// partners issue codes, this is the one place that checks them; the page
// does not change. The code's last four digits go in guest_class_note so an
// operator can see how a VIP arrived. The write is the consumer door's
// joinVipClass (admin_set_guest_standing, guest_class's one writer). No
// partner, no end date; an operator can still set both.
//
// Body: { code: string }
// Response: { ok: true, guest_class: "vip" }
//   400 "Enter the 12-digit code." · 404 consumer_not_found

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
  serveJson,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { joinVipClass } from "../_shared/consumer-doc.ts";
import { parseClassCode } from "./class-code.ts";

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
  const code = parseClassCode(bodyRes.body.code);
  if (!code) {
    return json({ ok: false, error: "Enter the 12-digit code." }, 400);
  }

  const res = await joinVipClass(
    adminClient(envRes.env),
    authRes.user.id,
    `Joined with code …${code.slice(-4)} (emulated, MESITA-2984)`,
  );
  if (!res.ok) return json({ ok: false, error: res.error }, res.status);
  return json({ ok: true, guest_class: "vip" });
});

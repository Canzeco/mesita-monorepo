// Supabase Edge Function — consumer-web-join-class
//
// Me › Class: a Regular guest joins VIP (MESITA-2984). The guest always taps;
// nothing joins on its own. VIP pays for the room, a guest a partner vouches
// for, so followers never make a VIP (MESITA-3224 closed via:"instagram").
//
// Body: { via: "code", code: "<12 digits>" }
//       | { via: "leave" } — a VIP goes back to Regular (Pato, MESITA-3054:
//         "add button to downgrade class in the weird case someone wishes
//         to"); 200 { ok, guest_class: "regular", left }.
//   code — issued by an operator on Admin › Guests
//          and used once (MESITA-3540). consumer_redeem_vip_invitation
//          locks the guest, refuses after 10 wrong codes in an hour, uses
//          the code and makes the guest VIP in one transaction. Twelve zeros
//          (MESITA-3071's emulator code) joins nothing any more.
//
// Response: 200 { ok: true, guest_class: "vip", joined } — joined:false when
// the guest was already VIP (a retry is safe).
// Errors { ok: false, code, error, ... } — the codes are listed in Notion
// Docs › Identity (Class):
//   400 bad_request · 400 bad_code · 403 invalid_code (unknown, used or
//   revoked: one answer) · 429 too_many_attempts · 404 consumer_not_found ·
//   500 join_failed { request_id } (never the database's own words).
// Every request logs one `class_join` line {via, outcome}; a code's last four
// digits at most.
//
// The decisions live in join.ts (handleJoin), tested with no network.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readClassJoinRow, redeemVipInvitation, writeOwnGuestClass } from "../_shared/consumer-doc.ts";
import { handleJoin } from "./join.ts";

serveJson("consumer-web-join-class", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const userId = user.id;
  const res = await handleJoin(bodyRes.body, {
    redeemCode: (code) => redeemVipInvitation(admin, userId, code),
    readRow: () => readClassJoinRow(admin, userId),
    writeClass: (guestClass, note) => writeOwnGuestClass(admin, userId, guestClass, note),
    requestId: crypto.randomUUID(),
  });
  const line = JSON.stringify({ event: "class_join", ...res.log });
  if (res.log.outcome === "error") console.error(line);
  else console.log(line);
  return json(res.body, res.status);
});

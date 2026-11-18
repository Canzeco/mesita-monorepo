// Supabase Edge Function — visit-web-review-story
//
// MESITA-4304, MESITA-4405: the waiter saw the guest's Instagram story on
// their own phone, after the guest paid, and approves it (the Story's bonus
// lands after the re-check) or rejects it (it does not tag @mesita and the
// place, or has no paid-partnership label; it never counts at this place
// again and the guest's Story waits for a new post). Needs the
// waiter code: a current `s2` staff token of the story's place, as the tab
// Verify (visit-web-verify-tab); the guest holds the QR, so the token alone
// never approves. story_review does the rest under the story's lock; a repeat
// of the same decision answers the stored one. The phone is kept as a hash of
// its device id, never the token. Logs carry the story id, never its token.
//
// Body: { token: 32 hex, decision: "approve" | "reject", staff_token,
//         place_id?: the staff token's place (must be the story's) }
// Response: { ok: true, outcome: approved | already_approved | rejected |
//             already_rejected, mention_id, reviewed_at }
//   400 bad_request · 403 staff_code_needed | wrong_place · 404 gone ·
//   409 already_decided | story_too_old · 500 server
// Logs: the Story's approved | rejected line with the waiter's device hash.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readStaffToken, staffDeviceHash, supabaseStaffStore } from "../_shared/staff.ts";
import { readReviewBody, reviewRefusal, staffGate } from "../_shared/story-review.ts";
import { errorMessage } from "../_shared/errors.ts";
import { storyLog } from "../_shared/story-log.ts";

const FN = "visit-web-review-story";

serveJson("visit-web-review-story", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readReviewBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
  const body = parsed.body;

  try {
    const { data: story, error } = await admin.from("story_mentions").select("id, review_place_id").eq("review_token", body.token).maybeSingle();
    if (error) throw new Error(`story_mentions: ${error.message}`);
    const row = story as { id: string; review_place_id: string | null } | null;
    if (!row || !row.review_place_id) {
      return json({ ok: false, code: "gone", error: "This Story QR is not valid. Ask the guest to show it again." }, 404);
    }
    const placeId = row.review_place_id;

    const keys = await supabaseStaffStore(admin).keys(placeId);
    const info = body.staffToken ? await readStaffToken(env.serviceKey, placeId, body.staffToken, keys, Date.now()) : null;
    const gate = staffGate(body, placeId, info);
    if (!gate.ok) {
      console.log(`[${FN}]`, JSON.stringify({ outcome: gate.code, place_id: placeId, mention_id: row.id, version: info?.version ?? null }));
      return json({ ok: false, code: gate.code, error: gate.error }, gate.status);
    }

    const deviceHash = await staffDeviceHash(gate.jti);
    const { data, error: rpcErr } = await admin.rpc("story_review", {
      p_token: body.token,
      p_place: placeId,
      p_approve: body.decision === "approve",
      p_device_hash: deviceHash,
    });
    if (rpcErr) throw new Error(`story_review: ${rpcErr.message}`);
    const r = data as {
      ok?: boolean; code?: string; outcome?: string; mention_id?: string; reviewed_at?: string;
      story_id?: string; purchase_id?: string; livemode?: boolean;
    } | null;
    if (!r?.ok) {
      const refusal = reviewRefusal(r?.code);
      console.log(`[${FN}]`, JSON.stringify({ outcome: refusal.code, place_id: placeId, mention_id: row.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
    }
    console.log(`[${FN}]`, JSON.stringify({ outcome: r.outcome, place_id: placeId, mention_id: row.id }));
    if (r.outcome === "approved" || r.outcome === "rejected") {
      storyLog(r.outcome, {
        story_id: r.story_id, purchase_id: r.purchase_id, place_id: placeId, livemode: r.livemode, device_hash: deviceHash, via: "waiter",
      });
    }
    return json({ ok: true, outcome: r.outcome, mention_id: r.mention_id ?? row.id, reviewed_at: r.reviewed_at ?? null });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ step: "review", error: errorMessage(err) }));
    return json({ ok: false, code: "server", error: "Couldn't save. Try again" }, 500);
  }
});

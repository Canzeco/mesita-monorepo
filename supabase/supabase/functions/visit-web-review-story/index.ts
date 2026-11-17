// Supabase Edge Function — visit-web-review-story
//
// MESITA-4264: staff saw the guest's Instagram story on their own phone and
// approve it (one story of the candidates visit-web-get-story listed) or
// reject (none of them tags this place). Approving needs the waiter code:
// a current `s2` staff token of the purchase's place, as the tab Verify
// (visit-web-verify-tab); the guest holds the QR, so the token alone never
// approves. wallet_review_story does the rest under the pair lock; a second
// approve of the same story answers the stored time. The phone is kept as a
// hash of its device id, never the token.
//
// Body: { token: 32 hex, decision: "approve" | "reject",
//         mention_id?: uuid (required to approve), staff_token,
//         place_id?: the staff token's place (must be the purchase's) }
// Response: { ok: true, outcome: approved | already_approved | rejected,
//             approved_at?, recheck_at?, bonus_at?, mention_id?, reviewed_at? }
//   400 bad_request · 403 staff_code_needed | forbidden · 404 gone ·
//   409 reload | refunded | not_paid | already_decided | mention_claimed |
//       mention_expired | handle_mismatch | livemode_mismatch · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readStaffToken, staffDeviceHash, supabaseStaffStore } from "../_shared/staff.ts";
import { readReviewBody, reviewRefusal, staffGate } from "../_shared/story-review.ts";
import { errorMessage } from "../_shared/errors.ts";

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
    const { data: row, error } = await admin.from("wallet_purchases")
      .select("id, place_id").eq("story_token", body.token).eq("voucher", "voucher_story").maybeSingle();
    if (error) throw new Error(`wallet_purchases: ${error.message}`);
    if (!row) return json({ ok: false, code: "gone", error: "This Story voucher is not valid. Ask the guest to show it again." }, 404);
    const placeId = (row as { place_id: string }).place_id;

    const keys = await supabaseStaffStore(admin).keys(placeId);
    const info = body.staffToken ? await readStaffToken(env.serviceKey, placeId, body.staffToken, keys, Date.now()) : null;
    const gate = staffGate(body, placeId, info);
    if (!gate.ok) {
      console.log(`[${FN}]`, JSON.stringify({ outcome: gate.code, place_id: placeId, version: info?.version ?? null }));
      return json({ ok: false, code: gate.code, error: gate.error }, gate.status);
    }

    const { data, error: rpcErr } = await admin.rpc("wallet_review_story", {
      p_token: body.token,
      p_mention: body.mentionId,
      p_approve: body.decision === "approve",
      p_device_hash: await staffDeviceHash(gate.jti),
    });
    if (rpcErr) throw new Error(`wallet_review_story: ${rpcErr.message}`);
    const r = data as {
      ok?: boolean; code?: string; outcome?: string; purchase_id?: string;
      approved_at?: string; recheck_at?: string; mention_id?: string; reviewed_at?: string;
    } | null;
    if (!r?.ok) {
      const refusal = reviewRefusal(r?.code);
      console.log(`[${FN}]`, JSON.stringify({ outcome: refusal.code, place_id: placeId, purchase_id: (row as { id: string }).id }));
      return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
    }
    console.log(`[${FN}]`, JSON.stringify({ outcome: r.outcome, purchase_id: r.purchase_id, place_id: placeId, mention_id: r.mention_id ?? null }));
    return json({
      ok: true,
      outcome: r.outcome,
      ...(r.approved_at ? { approved_at: r.approved_at, recheck_at: r.recheck_at ?? null, bonus_at: r.recheck_at ?? null } : {}),
      ...(r.mention_id ? { mention_id: r.mention_id } : {}),
      ...(r.reviewed_at ? { reviewed_at: r.reviewed_at } : {}),
    });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ step: "review", error: errorMessage(err) }));
    return json({ ok: false, code: "server", error: "Couldn't save. Try again" }, 500);
  }
});

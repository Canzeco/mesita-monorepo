// Supabase Edge Function — admin-web-story-override
//
// MESITA-4264, MESITA-4405: the operator settles a Story dispute without
// hand SQL, on the Story record (by its purchase id). Super-admin only;
// every call is logged with the actor.
//   release      write the bonus now; also lifts a void that never paid a
//                bonus (expired, unreachable…)
//   void         void the bonus (reason operator); after a release it
//                reverses the bonus entry, up to what the guest still holds
//   recheck_now  fetch an approved Story's story again now and settle it, as
//                the cron would
// release / void go through wallet_override_story; recheck_now through the
// cron's own re-check (_shared/story-recheck.ts).
//
// MESITA-4549, the AI bot's desk, by mention:
//   ai_attach    { mention_id, place_id }: the operator saw the restaurant tag;
//                a forced narrow verdict attaches it (refused once attached)
//   ai_reject    { mention_id }: rejected, reason operator (never paid)
//   ai_recheck   { mention_id }: back into the bot's queue with fresh tries
//   ai_reviewed  { mention_id }: the shadow-start spot check is done
//
// Body: { purchase_id: uuid, action: "release" | "void" | "recheck_now" }
// Response: { ok: true, action, outcome, ... }
//   400 bad_request · 401/403 (not a super-admin) · 404 not_found ·
//   409 already_decided | refunded | not_paid · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { errorMessage } from "../_shared/errors.ts";
import { readStoryRules } from "../_shared/story-mention.ts";
import { recheckOne } from "../_shared/story-recheck.ts";
import { storyLog } from "../_shared/story-log.ts";

const FN = "admin-web-story-override";
const ACTIONS = new Set(["release", "void", "recheck_now"]);
const AI_ACTIONS = new Set(["ai_attach", "ai_reject", "ai_recheck", "ai_reviewed"]);

serveJson("admin-web-story-override", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { purchase_id: purchaseId, action } = bodyRes.body;
  if (typeof action === "string" && AI_ACTIONS.has(action)) {
    const mentionId = bodyRes.body.mention_id;
    const placeId = bodyRes.body.place_id;
    if (!isUuid(mentionId) || (action === "ai_attach" && !isUuid(placeId))) {
      return json({ ok: false, code: "bad_request", error: "Body needs mention_id (and place_id to attach)" }, 400);
    }
    try {
      const { data: held } = await admin.from("stories").select("purchase_id, state").eq("mention_id", mentionId).maybeSingle();
      const attached = !!(held as { purchase_id?: string | null } | null)?.purchase_id;
      if (attached && action !== "ai_reviewed") {
        return json({ ok: false, code: "locked", error: "That story already holds a voucher" }, 409);
      }
      let outcome: string = action;
      if (action === "ai_attach") {
        const verdict = { mode: "narrow", looks_like_story: true, candidates: [{ place_id: placeId, handle_visible: true, location_visible: false }], notes: "operator" };
        const { data, error } = await admin.rpc("story_ai_verdict", { p_mention: mentionId, p_verdict: verdict, p_model: "operator", p_force: true });
        if (error) throw new Error(`story_ai_verdict: ${error.message}`);
        const r = (data ?? {}) as { ok?: boolean; outcome?: string; code?: string };
        if (r.ok === false) return json({ ok: false, code: r.code ?? "refused", error: `Refused: ${r.code ?? "unknown"}` }, 409);
        outcome = r.outcome === "matched" ? "attached" : (r.outcome ?? "checked");
      } else if (action === "ai_reject") {
        const { error } = await admin.from("story_mentions")
          .update({ ai_outcome: "rejected", ai_reason: "operator", ai_checked_at: new Date().toISOString(), ai_claimed_at: null }).eq("id", mentionId);
        if (error) throw new Error(`reject: ${error.message}`);
      } else if (action === "ai_recheck") {
        const { error } = await admin.from("story_mentions")
          .update({ ai_outcome: null, ai_reason: null, ai_checked_at: null, ai_claimed_at: null, ai_tries: 0, ai_last_error: null }).eq("id", mentionId);
        if (error) throw new Error(`recheck: ${error.message}`);
      } else {
        const { error } = await admin.from("story_mentions").update({ ai_reviewed_at: new Date().toISOString() }).eq("id", mentionId);
        if (error) throw new Error(`reviewed: ${error.message}`);
      }
      console.log(`[${FN}]`, JSON.stringify({ actor: user.id, mention_id: mentionId, place_id: placeId ?? null, action, outcome }));
      return json({ ok: true, action, outcome });
    } catch (err) {
      console.error(`[${FN}]`, JSON.stringify({ actor: user.id, mention_id: mentionId, action, error: errorMessage(err) }));
      return json({ ok: false, code: "server", error: "Couldn't save. Try again" }, 500);
    }
  }
  if (!isUuid(purchaseId) || typeof action !== "string" || !ACTIONS.has(action)) {
    return json({ ok: false, code: "bad_request", error: "Body needs purchase_id and action release|void|recheck_now" }, 400);
  }

  try {
    if (action === "recheck_now") {
      const report = await recheckOne(admin, purchaseId, (await readStoryRules(admin)).recheckMeta);
      console.log(`[${FN}]`, JSON.stringify({ actor: user.id, purchase_id: purchaseId, action, ...report }));
      return json({ ok: true, action, outcome: report.released ? "released" : report.voided ? "voided" : report.failed ? "failed" : "checked", ...report });
    }
    const { data, error } = await admin.rpc("wallet_override_story", { p_purchase: purchaseId, p_action: action, p_actor: user.id });
    if (error) throw new Error(`wallet_override_story: ${error.message}`);
    const r = (data ?? {}) as Record<string, unknown> & { ok?: boolean; code?: string };
    console.log(`[${FN}]`, JSON.stringify({ actor: user.id, purchase_id: purchaseId, action, answer: r }));
    if (r.outcome === "released" || r.outcome === "voided") {
      storyLog(r.outcome === "released" ? "released" : "void", {
        story_id: r.story_id as string | undefined, purchase_id: purchaseId, place_id: r.place_id as string | undefined,
        livemode: r.livemode as boolean | undefined, reason: r.outcome === "voided" ? "operator" : null, via: "operator",
      });
    }
    if (!r.ok) {
      const status = r.code === "not_found" ? 404 : r.code === "bad_request" ? 400 : 409;
      return json({ ok: false, code: r.code ?? "server", error: `Refused: ${r.code ?? "unknown"}` }, status);
    }
    return json({ ...r, ok: true, action });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ actor: user.id, purchase_id: purchaseId, action, error: errorMessage(err) }));
    return json({ ok: false, code: "server", error: "Couldn't save. Try again" }, 500);
  }
});

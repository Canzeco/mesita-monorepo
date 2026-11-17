// Supabase Edge Function — admin-web-story-override
//
// MESITA-4264, MESITA-4297: the operator settles a Story dispute without hand
// SQL. Super-admin only; every call is logged with the actor.
// On a paid Story (purchase_id):
//   release        write the bonus now (refused once voided)
//   void           void the bonus (reason operator); after a release it
//                  reverses the bonus entry, up to what the guest still holds
//   recheck_now    fetch the story again now and settle it, as the cron would
// On a story check before payment (check_id — the id, never the QR token):
//   expire_check   end a wrong or stuck approval (the guest asks again)
//   release_story  let go of the check's story; an approved check opens again
// There is no unapprove: before payment use expire_check, after it void.
// release / void go through wallet_override_story, the check actions through
// wallet_story_check_admin, recheck_now through the cron's own re-check.
//
// Body: { purchase_id: uuid, action: "release" | "void" | "recheck_now" }
//     | { check_id: uuid, action: "expire_check" | "release_story" }
// Response: { ok: true, action, outcome, ... }
//   400 bad_request | unknown_action { actions } · 401/403 (not a super-admin) ·
//   404 not_found · 409 already_decided | refunded | not_paid | used · 500 server

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { errorMessage } from "../_shared/errors.ts";
import { readStoryRules } from "../_shared/story-mention.ts";
import { recheckOne } from "../_shared/story-recheck.ts";

const FN = "admin-web-story-override";
const PURCHASE_ACTIONS = ["release", "void", "recheck_now"];
const CHECK_ACTIONS = ["expire_check", "release_story"];

serveJson("admin-web-story-override", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { purchase_id: purchaseId, check_id: checkId, action } = bodyRes.body;
  if (typeof action !== "string" || ![...PURCHASE_ACTIONS, ...CHECK_ACTIONS].includes(action)) {
    return json({
      ok: false,
      code: "unknown_action",
      actions: [...PURCHASE_ACTIONS, ...CHECK_ACTIONS],
      error: `action must be one of ${[...PURCHASE_ACTIONS, ...CHECK_ACTIONS].join(", ")} (unapprove is gone: expire_check before payment, void after)`,
    }, 400);
  }
  if (CHECK_ACTIONS.includes(action)) {
    if (!isUuid(checkId)) return json({ ok: false, code: "bad_request", error: "Body needs check_id for a check action" }, 400);
    try {
      const { data, error } = await admin.rpc("wallet_story_check_admin", { p_check: checkId, p_action: action });
      if (error) throw new Error(`wallet_story_check_admin: ${error.message}`);
      const r = (data ?? {}) as Record<string, unknown> & { ok?: boolean; code?: string };
      console.log(`[${FN}]`, JSON.stringify({ actor: user.id, check_id: checkId, action, answer: r }));
      if (!r.ok) return json({ ok: false, code: r.code ?? "server", error: `Refused: ${r.code ?? "unknown"}` }, r.code === "not_found" ? 404 : 409);
      return json({ ...r, ok: true, action });
    } catch (err) {
      console.error(`[${FN}]`, JSON.stringify({ actor: user.id, check_id: checkId, action, error: errorMessage(err) }));
      return json({ ok: false, code: "server", error: "Couldn't save. Try again" }, 500);
    }
  }
  if (!isUuid(purchaseId)) return json({ ok: false, code: "bad_request", error: "Body needs purchase_id for a bonus action" }, 400);

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
    if (!r.ok) {
      const status = r.code === "not_found" ? 404 : r.code === "unknown_action" ? 400 : 409;
      return json({ ok: false, code: r.code ?? "server", error: `Refused: ${r.code ?? "unknown"}` }, status);
    }
    return json({ ...r, ok: true, action });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ actor: user.id, purchase_id: purchaseId, action, error: errorMessage(err) }));
    return json({ ok: false, code: "server", error: "Couldn't save. Try again" }, 500);
  }
});

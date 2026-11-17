// Supabase Edge Function — admin-web-story-override
//
// MESITA-4264, MESITA-4296: the operator settles a Story dispute without
// hand SQL. Super-admin only; every call is logged with the actor.
//   release      write the bonus now; also lifts a void that never paid a
//                bonus (mention_lost, no_mention, unreachable…)
//   void         void the bonus (reason operator); after a release it
//                reverses the bonus entry, up to what the guest still holds
//   recheck_now  fetch the claimed story again now and settle it, as the
//                cron would
// release / void go through wallet_override_story; recheck_now through the
// cron's own re-check (_shared/story-recheck.ts).
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

const FN = "admin-web-story-override";
const ACTIONS = new Set(["release", "void", "recheck_now"]);

serveJson("admin-web-story-override", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { purchase_id: purchaseId, action } = bodyRes.body;
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

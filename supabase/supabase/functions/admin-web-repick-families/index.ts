// Supabase Edge Function — admin-web-repick-families (MESITA-4238)
//
// Re-picks Mesita Families on live places with the careful family prompt, one
// batch per call (`_shared/families-repick.ts`). Two callers, one door each:
//   * a super-admin from web-admin's Multiple Places card (source
//     `repick-families`, actor = the admin);
//   * the agent with a service-role bearer — the eval (`deno task
//     families-eval`) and the live run, since Pato runs nothing and the admin
//     page is OTP-gated (source `repick-families-agent`, actor null).
// Writes go only through the RPC `admin_repick_family_keys`.
//
// Body: { dryRun?, arm?: "repick"|"enrich", model?, place_ids?, cursor?, batch?, run_id? }
// Errors: 401/403 for anyone else · 400 {code:"bad_request", detail} · 500
// {code:"unexpected", correlation_id}. A per-place failure is a row, never a 5xx.
//
// Local:  supabase functions serve admin-web-repick-families
// Deploy: supabase functions deploy admin-web-repick-families

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { openRequest, requireAdminRequest } from "../_shared/request.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { parseRepickRequest, type RepickSource, runRepick } from "../_shared/families-repick.ts";

serveJson("admin-web-repick-families", async (req) => {
  const open = openRequest(req);
  if (open instanceof Response) return open;

  let source: RepickSource;
  let actor: string | null;
  const internal = requireInternalCaller(req, open.env);
  if (internal.ok) {
    source = "repick-families-agent";
    actor = null;
  } else {
    const ctx = await requireAdminRequest(req);
    if (ctx instanceof Response) return ctx;
    source = "repick-families";
    actor = ctx.user.id;
  }

  const body = await readJsonOr<unknown>(req, {});
  const parsed = parseRepickRequest(body, () => crypto.randomUUID());
  if (typeof parsed === "string") return json({ ok: false, code: "bad_request", detail: parsed }, 400);

  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim() ?? "";
  if (!openaiKey && !(parsed.dryRun && !parsed.placeIds)) {
    return json({ ok: false, code: "unexpected", correlation_id: crypto.randomUUID(), detail: "OPENAI_KEY is not set" }, 500);
  }

  try {
    return json(await runRepick(open.admin, parsed, { openaiKey, source, actor }));
  } catch (e) {
    const correlationId = crypto.randomUUID();
    console.error("[admin-web-repick-families]", correlationId, e instanceof Error ? e.message : String(e));
    return json({ ok: false, code: "unexpected", correlation_id: correlationId }, 500);
  }
});

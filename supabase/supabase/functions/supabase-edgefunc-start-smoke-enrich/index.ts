// Supabase Edge Function — supabase-edgefunc-start-smoke-enrich (internal caller)
//
// MESITA-2803: starts ONE real Enrich run on the fixture place
// (_shared/smoke-enrich.ts), so a pipeline check needs no admin press. The
// body is ignored: it cannot pick a place, and one call is at most one run.
// It refuses when the fixture is missing (404), changed in the last hour
// (429), or already enriching (409, the claim from MESITA-2805). Nothing
// schedules it: a run happens only when someone calls it.
//
// An agent starts it with the Supabase MCP `execute_sql`, using the vault
// key pg_cron already uses (no new secret):
//
//   select net.http_post(
//     url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-edgefunc-start-smoke-enrich',
//     headers := jsonb_build_object(
//       'Content-Type', 'application/json',
//       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
//                                      where name = 'scheduler_service_role_key'),
//       'X-Internal-Caller', 'agent-smoke'),
//     body := '{}'::jsonb);
//
// then reads the answer from net._http_response and judges the run by the
// fixture's DB effects (enriched_at, fields, media).
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · start · smoke-enrich.
// Auth: verify_jwt = true + requireInternalRequest (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
import { startSmokeEnrich } from "../_shared/smoke-enrich.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

const SOURCE = "supabase-edgefunc-start-smoke-enrich";

serveJson("supabase-edgefunc-start-smoke-enrich", async (req) => {
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, callerName } = ctx;

  const started = await startSmokeEnrich(admin);
  await recordAdminOperatorEvent(admin, {
    verb: "enrich",
    outcome: started.ok ? "succeeded" : "failed",
    placeId: started.placeId ?? null,
    actorUserId: null,
    source: SOURCE,
    detail: { smoke: true, caller: callerName, ...(started.ok ? {} : { error: started.error }) },
  });
  if (!started.ok) return json({ ok: false, error: started.error }, started.status);
  return json({ ok: true, placeId: started.placeId, task: started.task });
});

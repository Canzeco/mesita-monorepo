// Supabase Edge Function — supabase-edgefunc-start-agent-enrich (internal caller)
//
// MESITA-3242: starts a real Enrich on up to 10 places named by Google place
// id (_shared/agent-enrich.ts), so an agent can re-enrich the places a Links
// fix was made for without a super-admin press. It refuses when Firecrawl
// holds under 100 credits (402), skips a place not in the catalog or changed
// in the last hour, and never starts a place already enriching. Nothing
// schedules it: a run happens only when someone calls it.
//
// An agent starts it with the Supabase MCP `execute_sql`, using the vault
// key pg_cron already uses (no new secret):
//
//   select net.http_post(
//     url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-edgefunc-start-agent-enrich',
//     headers := jsonb_build_object(
//       'Content-Type', 'application/json',
//       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
//                                      where name = 'scheduler_service_role_key'),
//       'X-Internal-Caller', 'agent-enrich'),
//     body := jsonb_build_object('googlePlaceIds', jsonb_build_array('ChIJ…')));
//
// then reads the answer from net._http_response and judges each run by the
// place's DB effects (enriched_at, links, media).
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · start · agent-enrich.
// Auth: verify_jwt = true + requireInternalCaller (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { startAgentEnrich } from "../_shared/agent-enrich.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

const SOURCE = "supabase-edgefunc-start-agent-enrich";

serveJson("supabase-edgefunc-start-agent-enrich", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const caller = requireInternalCaller(req, envRes.env);
  if (!caller.ok) return caller.response;

  const bodyRes = await readJson<{ googlePlaceIds?: unknown }>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const admin = adminClient(envRes.env);
  const started = await startAgentEnrich(admin, bodyRes.body.googlePlaceIds);
  await recordAdminOperatorEvent(admin, {
    verb: "enrich",
    outcome: started.ok ? "succeeded" : "failed",
    placeId: started.ok && started.started.length === 1 ? started.started[0] : null,
    actorUserId: null,
    source: SOURCE,
    detail: started.ok
      ? { agent: true, caller: caller.callerName, count: started.started.length, skipped: started.skipped.length }
      : { agent: true, caller: caller.callerName, error: started.error },
  });
  if (!started.ok) return json(started, started.status);
  return json(started);
});

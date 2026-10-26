// Supabase Edge Function — admin-web-enrich-place (product caller / admin)
//
// Direct execute. One place starts enrich single place. A list starts
// enrich multiple places once. Render decides how many places run at once.
// Nothing here waits on the run. Before it calls Render, this marks each
// place enriching (content_state = generating). If Render refuses the run,
// a place still generating goes back to ready when it was enriched before
// and to failed when it never was. The profile is written once, at the end.
// The start itself is _shared/enrich-start.ts, which the guest vote door
// shares.
//
// Internal enricher control — super-admin gated, admin console only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, readPlaceIdAlias } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { startEnrichment } from "../_shared/enrich-start.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

type Body = {
  projectId?: string;
  placeId?: string;
  placeIds?: string[];
  // There is one Enrich (MESITA-2799). An older admin tab may still send
  // `overwrite` or `depth`; neither is read.
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can re-enrich places.");
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const listed = Array.isArray(bodyRes.body.placeIds)
    ? bodyRes.body.placeIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  const placeId = readPlaceIdAlias(bodyRes.body);
  const placeIds = listed.length > 0 ? listed : placeId ? [placeId] : [];

  const started = await startEnrichment(admin, { placeIds });
  if (!started.ok) {
    await recordAdminOperatorEvent(admin, {
      verb: "enrich",
      outcome: "failed",
      actorUserId: authRes.user.id,
      source: "admin-web-enrich-place",
      detail: { count: placeIds.length, error: started.error },
    });
    return json({ ok: false, error: started.error }, started.status);
  }
  await recordAdminOperatorEvent(admin, {
    verb: "enrich",
    outcome: "succeeded",
    placeId: placeIds.length === 1 ? placeIds[0] : null,
    actorUserId: authRes.user.id,
    source: "admin-web-enrich-place",
    detail: { count: placeIds.length },
  });
  return json({ ok: true, enrichmentTriggered: true, task: started.task });
});

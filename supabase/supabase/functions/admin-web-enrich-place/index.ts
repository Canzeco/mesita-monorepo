// Supabase Edge Function — admin-web-enrich-place (product caller / admin)
//
// Direct execute. One place starts the Render task enrichSingle. A list
// starts enrichMultiple once. The workflow runtime decides how many places
// run at once and where an external API bottlenecks. Nothing here waits on
// a cron poller.
//
// Internal enricher control — super-admin gated, admin console only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, readPlaceIdAlias } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { enrichmentRun } from "./start-enrichment.ts";

type Body = {
  projectId?: string;
  placeId?: string;
  placeIds?: string[];
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
  if (placeIds.length === 0) return json({ ok: false, error: "Missing placeId" }, 400);
  if (placeIds.length > 50) {
    return json({ ok: false, error: "At most 50 places per enrich call." }, 400);
  }

  const { data: places, error: placeErr } = await admin
    .from("place_profiles")
    .select("id, google_place_id")
    .in("id", placeIds);
  if (placeErr) return json({ ok: false, error: `places: ${placeErr.message}` }, 500);
  const byId = new Map((places ?? []).map((row) => [row.id, (row.google_place_id ?? "").toString().trim()]));
  for (const id of placeIds) {
    if (!byId.has(id)) return json({ ok: false, error: "Place not found" }, 404);
    if (!byId.get(id)) {
      return json({ ok: false, error: "Place has no Google Place ID — nothing to enrich from." }, 422);
    }
  }

  const key = Deno.env.get("RENDER_API_KEY")?.trim() ?? "";
  if (!key) return json({ ok: false, error: "Server misconfigured" }, 500);

  const run = enrichmentRun(placeIds);
  const res = await fetch("https://api.render.com/v1/task-runs", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(run),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ ok: false, error: detail.slice(0, 300) || `Render did not start the run (${res.status})` }, 502);
  }
  return json({ ok: true, enrichmentTriggered: true, task: run.task });
});

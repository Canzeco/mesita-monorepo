// Supabase Edge Function — admin-web-enrich-place (product caller / admin)
//
// Direct execute. One place starts enrich single place. A list starts
// enrich multiple places once. Render decides how many places run at once.
// Nothing here waits on the run. When Render accepts it, this marks each
// place enriching and returns. The profile is written once, at the end.
//
// Internal enricher control — super-admin gated, admin console only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, readPlaceIdAlias } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { writePlace } from "../_shared/place-doc.ts";
import { loadEnrichConfig } from "../_shared/enrich-config.ts";
import { ENRICHING_PATCH, enrichDepthOf, enrichmentKnobs, enrichmentRun, renderApiKey } from "./start-enrichment.ts";

type Body = {
  projectId?: string;
  placeId?: string;
  placeIds?: string[];
  overwrite?: boolean;
  depth?: string;
};

const SAVED_KEYS = [
  "google_name",
  "mesita_name",
  "name",
  "category",
  "category_label",
  "description",
  "address",
  "zone",
  "city",
  "lat",
  "lng",
  "photos",
  "phone",
  "tags",
  "website_url",
  "instagram_url",
  "facebook_url",
  "opentable_url",
  "uber_eats_url",
  "whatsapp_url",
  "google_maps_url",
  "google_address",
] as const;

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
  const overwrite = bodyRes.body.overwrite === true;
  const depth = enrichDepthOf(bodyRes.body.depth);
  const placeIds = listed.length > 0 ? listed : placeId ? [placeId] : [];
  if (placeIds.length === 0) return json({ ok: false, error: "Missing placeId" }, 400);
  if (placeIds.length > 50) {
    return json({ ok: false, error: "At most 50 places per enrich call." }, 400);
  }

  const { data: places, error: placeErr } = await admin
    .from("place_profiles")
    .select(["id", "google_place_id", ...SAVED_KEYS].join(", "))
    .in("id", placeIds);
  if (placeErr) return json({ ok: false, error: `places: ${placeErr.message}` }, 500);
  const rows = new Map((places ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    return [String(record.id), record] as const;
  }));
  for (const id of placeIds) {
    const row = rows.get(id);
    if (!row) return json({ ok: false, error: "Place not found" }, 404);
    if (!String(row.google_place_id ?? "").trim()) {
      return json({ ok: false, error: "Place has no Google Place ID — nothing to enrich from." }, 422);
    }
  }

  const key = renderApiKey(Deno.env);
  if (!key) return json({ ok: false, error: "Server misconfigured" }, 500);

  const knobs = enrichmentKnobs(await loadEnrichConfig(admin));
  const marked = await Promise.all(placeIds.map((id) =>
    writePlace(admin, { table: "places", mode: "update", id, patch: { ...ENRICHING_PATCH } })
  ));
  const failed = marked.find((row) => !row.ok);
  if (failed && !failed.ok) {
    return json({ ok: false, error: `The place was not marked enriching: ${failed.error}` }, 500);
  }
  const { data: stamps, error: stampErr } = await admin
    .from("place_profiles")
    .select("id, updated_at")
    .in("id", placeIds);
  if (stampErr) return json({ ok: false, error: stampErr.message }, 500);
  const updatedAt = new Map((stamps ?? []).map((row) => [row.id as string, (row.updated_at ?? null) as string | null]));
  const jobs = placeIds.map((id) => {
    const row = rows.get(id) ?? {};
    const saved: Record<string, unknown> = {};
    for (const column of SAVED_KEYS) saved[column] = row[column] ?? null;
    return {
      placeId: id,
      googlePlaceId: String(row.google_place_id ?? "").trim(),
      knobs,
      depth,
      overwrite,
      baseUpdatedAt: updatedAt.get(id) ?? null,
      saved,
    };
  });
  const run = enrichmentRun(jobs);
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
    await Promise.all(placeIds.map(async (id) => {
      const { data, error } = await admin
        .from("place_profiles")
        .select("content_state, enriched_at")
        .eq("id", id)
        .maybeSingle();
      if (error || !data || data.content_state !== "generating") return;
      const next = typeof data.enriched_at === "string" && data.enriched_at.trim() ? "ready" : "failed";
      await writePlace(admin, { table: "places", mode: "update", id, patch: { content_state: next } });
    }));
    return json({ ok: false, error: detail.slice(0, 300) || `Render did not start the run (${res.status})` }, 502);
  }
  return json({ ok: true, enrichmentTriggered: true, task: run.task, overwrite });
});

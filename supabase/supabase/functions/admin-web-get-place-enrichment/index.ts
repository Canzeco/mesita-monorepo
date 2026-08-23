// Supabase Edge Function — admin-web-get-place-enrichment (product caller / admin)
//
// Read-only per-place Enricher inspector for the admin console. Given a
// project_id, returns:
//   • media  — one entry per stored image (keyed by public_url AND source_url,
//     so it resolves whether places.photos[] holds the mirrored URL or the raw
//     source URL when mirroring failed), carrying SOURCE (google/website/
//     instagram), the enricher vision ANALYSIS text, plus the pre-analysis
//     source metadata: caption/likes for Instagram (+ comments/timestamp/video
//     flag) and alt/page/dimensions for website images.
//   • status — enrichment progress for the place: projects.content_status +
//     the place_research stage/status/error + last_enriched_at (the moment the
//     pipeline last reached stage='done').
//   • serpSummary — the SERP Summary (Agent X's soft editorial read) for the
//     last run. Selected as a JSON PATH, never as the whole `gathered` blob:
//     that column is tens of KB and shipping it wholesale is the regression
//     MESITA-1198 already had to undo once.
//   • schedule — the per-place cadence (MESITA-1148): places.enrich_every_days
//     / enrich_mode / enrich_next_at, written by admin-web-set-place-enrichment
//     and honoured by the queue_due_place_enrichments cron. NULL everyDays =
//     manual only.
//
// Internal enricher output — super-admin gated, admin console only. Never
// exposed through a shared business EF.
//
// Local:  supabase functions serve admin-web-get-place-enrichment
// Deploy: supabase functions deploy admin-web-get-place-enrichment

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  type MediaRow,
  indexMediaByUrl,
} from "./place-enrichment-media.ts";

type Body = { projectId?: string; placeId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  // placeId is the MESITA-26 alias for the place-row id (== project_id here).
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return jsonError("Missing projectId", 400);

  const [mediaRes, projectRes, researchRes, placeRes] = await Promise.all([
    admin
      .from("place_media_assets")
      .select(
        "public_url, source, status, analysis_text, caption, likes_count, source_url, source_metadata",
      )
      .eq("place_id", projectId)
      .order("created_at", { ascending: true }),
    admin
      .from("projects")
      .select("content_status")
      .eq("id", projectId)
      .maybeSingle(),
    admin
      .from("place_research")
      .select(
        "stage, status, error, updated_at, serp_summary:gathered->grounding->>serpSummary",
      )
      .eq("place_id", projectId)
      .maybeSingle(),
    admin
      .from("places")
      .select("enrich_every_days, enrich_mode, enrich_next_at, enriched_at")
      .eq("id", projectId)
      .maybeSingle(),
  ]);

  if (mediaRes.error) {
    return jsonError(`place_media_assets: ${mediaRes.error.message}`, 500);
  }
  if (projectRes.error) {
    return jsonError(`projects: ${projectRes.error.message}`, 500);
  }
  if (researchRes.error) {
    return jsonError(`place_research: ${researchRes.error.message}`, 500);
  }
  if (placeRes.error) {
    return jsonError(`places: ${placeRes.error.message}`, 500);
  }

  const rows = (mediaRes.data ?? []) as MediaRow[];
  const media = indexMediaByUrl(rows);

  const research = researchRes.data as
    | {
        stage: string | null;
        status: string | null;
        error: string | null;
        updated_at: string | null;
        serp_summary: string | null;
      }
    | null;

  const status = {
    content_status: (projectRes.data?.content_status ?? null) as string | null,
    stage: research?.stage ?? null,
    stage_status: research?.status ?? null,
    error: research?.error ?? null,
    // The pipeline stamps updated_at on every stage advance; when the row is
    // 'done' that timestamp is the completion time.
    last_enriched_at: research?.stage === "done" ? (research?.updated_at ?? null) : null,
    updated_at: research?.updated_at ?? null,
    // One of the three enrichment texts (SERP Summary · Presentation ·
    // Semantic Summary). It grounds link selection and the description, and it
    // is never a source of facts, ratings or prices.
    serp_summary: research?.serp_summary ?? null,
  };

  const placeRow = placeRes.data as
    | {
        enrich_every_days: number | null;
        enrich_mode: string | null;
        enrich_next_at: string | null;
        enriched_at: string | null;
      }
    | null;

  const schedule = {
    everyDays: placeRow?.enrich_every_days ?? null,
    mode: placeRow?.enrich_mode ?? "full",
    nextAt: placeRow?.enrich_next_at ?? null,
    // places.enriched_at is stamped by the contents stage on a successful
    // persist — the durable "last enriched", where status.last_enriched_at
    // only survives while the research row still sits at 'done'.
    lastEnrichedAt: placeRow?.enriched_at ?? null,
  };

  return json({ ok: true, media, status, schedule, count: rows.length });
});

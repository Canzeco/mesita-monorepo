// Starting an Enrich run. Render runs every Enrich: one place starts enrich
// single place, a list starts enrich multiple places, and Render decides how
// many run at once. Two callers start one: admin Enrich (admin-web-enrich-place)
// and the guest vote door at its threshold (place-requests.ts).
//
// Before Render is called each place is marked enriching (content_state =
// generating), the only write before the profile exists. If Render refuses the
// run, a place still generating goes back to ready when it was enriched before
// and to failed when it never was. Render writes the profile once, at the end,
// through enricher-edgefunc-write-place.
//
// The Google place id, the saved profile and the Enrichment page knobs ride on
// the job: Render has no database key. So do the Scout's and the Resolver's
// instructions and the Scout's per-place message, built here from the same
// constants and builder admin Enrichment renders, so what an operator reads is
// what the vendor receives.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { RESOLVER_INSTRUCTIONS } from "./enrich-channel-discovery.ts";
import { loadEnrichConfig, visionModelFor, type EnrichConfig } from "./enrich-config.ts";
import { buildScoutInput, SCOUT_INSTRUCTIONS } from "./enrich-serp.ts";
import { writePlace } from "./place-doc.ts";

const WORKFLOW = "mesita-monorepo";
const RENDER_TASK_RUNS = "https://api.render.com/v1/task-runs";

/** The most places one start may carry. */
export const ENRICH_MAX_PLACES = 50;

export type EnrichmentKnobs = {
  discoverWebsiteN: number;
  discoverInstagramN: number;
  discoverFacebookN: number;
  discoverOpentableN: number;
  discoverUbereatsN: number;
  perplexityPreset: string;
  scoutInstructions: string;
  resolverInstructions: string;
  gatherGoogleImages: number;
  gatherInstagramDepth: number;
  analyzeGoogleImages: number;
  analyzeInstagramImages: number;
  saveTotalImages: number;
  visionEnabled: boolean;
  saveImagesToStorage: boolean;
  imageAnalysisPrompt: string;
  imageSortingPrompt: string;
  visionModel: string;
  sortModel: string;
};

export type EnrichDepth = "quick" | "full";

export type EnrichJob = {
  placeId: string;
  googlePlaceId: string;
  knobs?: EnrichmentKnobs;
  /** Absent is Full. */
  depth?: EnrichDepth;
  overwrite?: boolean;
  /** The profile at the moment enriching was marked. The write refuses a newer row. */
  baseUpdatedAt?: string | null;
  saved?: Record<string, unknown>;
  /** The Scout's message for this place. Strong runs the Scout with it. */
  scoutInput?: string;
};

/** Anything other than quick is the whole enrichment. */
export function enrichDepthOf(value: unknown): EnrichDepth {
  return value === "quick" ? "quick" : "full";
}

type KnobSource = Pick<
  EnrichConfig,
  | "discoverCandidates"
  | "perplexityPreset"
  | "visionQuality"
  | "synthesisQuality"
  | "gatherGoogleImages"
  | "gatherInstagramDepth"
  | "analyzeGoogleImages"
  | "analyzeInstagramImages"
  | "saveTotalImages"
  | "visionEnabled"
  | "saveImagesToStorage"
  | "imageAnalysisPrompt"
  | "imageSortingPrompt"
>;

/** The saved Enrichment page, in the shape Render reads. The Scout and
 *  Resolver texts are the same constants the console shows. */
export function enrichmentKnobs(cfg: KnobSource): EnrichmentKnobs {
  return {
    discoverWebsiteN: cfg.discoverCandidates.website_url,
    discoverInstagramN: cfg.discoverCandidates.instagram_url,
    discoverFacebookN: cfg.discoverCandidates.facebook_url,
    discoverOpentableN: cfg.discoverCandidates.opentable_url,
    discoverUbereatsN: cfg.discoverCandidates.uber_eats_url,
    perplexityPreset: cfg.perplexityPreset,
    scoutInstructions: SCOUT_INSTRUCTIONS,
    resolverInstructions: RESOLVER_INSTRUCTIONS,
    gatherGoogleImages: cfg.gatherGoogleImages,
    gatherInstagramDepth: cfg.gatherInstagramDepth,
    analyzeGoogleImages: cfg.analyzeGoogleImages,
    analyzeInstagramImages: cfg.analyzeInstagramImages,
    saveTotalImages: cfg.saveTotalImages,
    visionEnabled: cfg.visionEnabled,
    saveImagesToStorage: cfg.saveImagesToStorage,
    imageAnalysisPrompt: cfg.imageAnalysisPrompt,
    imageSortingPrompt: cfg.imageSortingPrompt,
    visionModel: visionModelFor(cfg.visionQuality),
    sortModel: visionModelFor(cfg.synthesisQuality),
  };
}

/** The profile fields a run reads back so Overwrite off can keep them. */
export const SAVED_KEYS = [
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

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The Scout's message for one place, from what the place already holds. */
export function scoutInputFor(saved: Record<string, unknown>): string | null {
  const name = text(saved.name) || text(saved.mesita_name) || text(saved.google_name);
  if (!name) return null;
  const category = text(saved.category_label) || text(saved.category);
  return buildScoutInput({
    name,
    locationLine: text(saved.address),
    category: category && category !== "undefined" ? category : null,
  });
}

/** Enriching is the state alone, not a profile field. */
export const ENRICHING_PATCH = { content_state: "generating" } as const;

/** The live secret is RENDER_KEY. RENDER_API_KEY is the older name. */
export function renderApiKey(env: { get(name: string): string | undefined }): string {
  return (env.get("RENDER_KEY") ?? env.get("RENDER_API_KEY") ?? "").trim();
}

export function enrichmentRun(jobs: readonly EnrichJob[]): { task: string; input: unknown[] } {
  if (jobs.length === 1) {
    return { task: `${WORKFLOW}/enrich-single-place`, input: [jobs[0]] };
  }
  return { task: `${WORKFLOW}/enrich-multiple-places`, input: [jobs] };
}

/** What a refused start leaves: ready when enriched before, failed when never. */
export function contentStateAfterRefusal(row: {
  content_state: unknown;
  enriched_at: unknown;
}): "ready" | "failed" | null {
  if (row.content_state !== "generating") return null;
  return text(row.enriched_at) ? "ready" : "failed";
}

export type EnrichStart =
  | { ok: true; task: string }
  | { ok: false; status: number; error: string; blocked?: "enriching" };

/**
 * Start one Enrich run for `placeIds`. `claim` marks a place enriching only
 * when it is not already, so a caller racing another start (two guests'
 * votes) loses cleanly with `blocked: "enriching"` instead of paying twice.
 * Admin Enrich does not claim: a press is explicit intent.
 */
export async function startEnrichment(
  admin: SupabaseClient,
  opts: {
    placeIds: readonly string[];
    depth: EnrichDepth;
    overwrite: boolean;
    claim?: boolean;
    env?: { get(name: string): string | undefined };
    fetchImpl?: typeof fetch;
  },
): Promise<EnrichStart> {
  const placeIds = [...new Set(opts.placeIds.map((id) => id.trim()).filter(Boolean))];
  if (placeIds.length === 0) return { ok: false, status: 400, error: "Missing placeId" };
  if (placeIds.length > ENRICH_MAX_PLACES) {
    return { ok: false, status: 400, error: `At most ${ENRICH_MAX_PLACES} places per enrich call.` };
  }
  // A claim that lost on one place of many would strand the others enriching.
  if (opts.claim && placeIds.length !== 1) {
    return { ok: false, status: 400, error: "A claimed start carries one place." };
  }

  const { data: places, error: placeErr } = await admin
    .from("place_profiles")
    .select(["id", "google_place_id", ...SAVED_KEYS].join(", "))
    .in("id", placeIds);
  if (placeErr) return { ok: false, status: 500, error: `places: ${placeErr.message}` };
  const rows = new Map((places ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    return [String(record.id), record] as const;
  }));
  for (const id of placeIds) {
    const row = rows.get(id);
    if (!row) return { ok: false, status: 404, error: "Place not found" };
    if (!text(row.google_place_id)) {
      return { ok: false, status: 422, error: "Place has no Google Place ID — nothing to enrich from." };
    }
  }

  const key = renderApiKey(opts.env ?? Deno.env);
  if (!key) return { ok: false, status: 500, error: "Server misconfigured" };

  const knobs = enrichmentKnobs(await loadEnrichConfig(admin));
  const marked = await Promise.all(placeIds.map((id) =>
    opts.claim
      ? writePlace(admin, {
        table: "places",
        mode: "update",
        id,
        patch: { ...ENRICHING_PATCH },
        unlessWhile: "generating",
        select: "id",
        selectMode: "maybeSingle",
      })
      : writePlace(admin, { table: "places", mode: "update", id, patch: { ...ENRICHING_PATCH } })
  ));
  const failed = marked.find((row) => !row.ok);
  if (failed && !failed.ok) {
    return { ok: false, status: 500, error: `The place was not marked enriching: ${failed.error}` };
  }
  if (opts.claim && marked.some((row) => row.ok && !row.row)) {
    return { ok: false, status: 409, error: "The place is already enriching.", blocked: "enriching" };
  }

  const { data: stamps, error: stampErr } = await admin
    .from("place_profiles")
    .select("id, updated_at")
    .in("id", placeIds);
  if (stampErr) return { ok: false, status: 500, error: stampErr.message };
  const updatedAt = new Map((stamps ?? []).map((row) => [row.id as string, (row.updated_at ?? null) as string | null]));
  const jobs: EnrichJob[] = placeIds.map((id) => {
    const row = rows.get(id) ?? {};
    const saved: Record<string, unknown> = {};
    for (const column of SAVED_KEYS) saved[column] = row[column] ?? null;
    const scoutInput = scoutInputFor(saved);
    return {
      placeId: id,
      googlePlaceId: text(row.google_place_id),
      knobs,
      depth: opts.depth,
      overwrite: opts.overwrite,
      baseUpdatedAt: updatedAt.get(id) ?? null,
      saved,
      ...(scoutInput ? { scoutInput } : {}),
    };
  });
  const run = enrichmentRun(jobs);
  const res = await (opts.fetchImpl ?? fetch)(RENDER_TASK_RUNS, {
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
    // content_state lives on places, enriched_at on place_profiles: the
    // profiles view carries both.
    await Promise.all(placeIds.map(async (id) => {
      const { data, error } = await admin
        .from("profiles")
        .select("content_state, enriched_at")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return;
      const next = contentStateAfterRefusal(data);
      if (!next) return;
      await writePlace(admin, { table: "places", mode: "update", id, patch: { content_state: next } });
    }));
    return {
      ok: false,
      status: 502,
      error: detail.slice(0, 300) || `Render did not start the run (${res.status})`,
    };
  }
  return { ok: true, task: run.task };
}

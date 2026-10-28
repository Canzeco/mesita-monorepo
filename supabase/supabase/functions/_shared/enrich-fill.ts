// Fill-missing enrich (MESITA-2178).
//
// A manual Enrich run fills every ladder step that has not completed.
// `overwrite` names steps to redo even when they already completed; every
// other completed step is left alone. Description and Embedding also run
// when an earlier step of THIS run executed, because the words and the
// vectors are downstream of whatever just changed.
//
// `fill` is opt-in via the run's meta. A run without it keeps the old
// contract: null subprocesses means run every step the stage owns.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { SubprocessKey } from "./enrich-triggers.ts";
import { wants } from "./enrich-triggers.ts";
import { foldFunctionStateMap, type EnrichmentMap } from "./schema-catalog.ts";

export const FILL_STEPS = [
  "details",
  "serp",
  "links",
  "social",
  "reviews",
  "images",
  "description",
  "embedding",
] as const;

export type FillStep = (typeof FILL_STEPS)[number];

const STEP_SUBPROCESS: Record<FillStep, SubprocessKey> = {
  details: "google",
  serp: "serp",
  links: "links",
  social: "social",
  reviews: "reviews",
  images: "images",
  description: "synthesis",
  embedding: "embedding",
};

const EARLIER_THAN_DESCRIPTION: ReadonlySet<FillStep> = new Set([
  "details",
  "serp",
  "links",
  "social",
  "reviews",
  "images",
]);

export type EnrichFill = {
  /** True only when the run asked to fill missing steps. */
  fill: boolean;
  overwrite: ReadonlySet<FillStep>;
  completed: ReadonlySet<FillStep>;
  /** Steps this run has already executed, carried on gathered.stepsRan. */
  earlier: ReadonlySet<FillStep>;
  subprocesses: SubprocessKey[] | null;
};

export function parseOverwrite(raw: unknown): FillStep[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "overwrite must be a list of steps" };
  const out: FillStep[] = [];
  for (const item of raw) {
    const step = String(item ?? "").trim();
    if (!FILL_STEPS.includes(step as FillStep)) {
      return { error: `Unknown overwrite step '${step}'.` };
    }
    if (!out.includes(step as FillStep)) out.push(step as FillStep);
  }
  return out;
}

function bought(fill: EnrichFill, step: FillStep): boolean {
  return wants(fill.subprocesses, STEP_SUBPROCESS[step]);
}

function explicitBuy(fill: EnrichFill): boolean {
  return Array.isArray(fill.subprocesses);
}

/** Whether this run should execute `step`. Description/Embedding ignore `earlier`. */
export function stepRuns(fill: EnrichFill, step: FillStep): boolean {
  if (!fill.fill) return bought(fill, step);
  if (!bought(fill, step)) return false;
  if (fill.overwrite.has(step)) return true;
  if (explicitBuy(fill)) return true;
  return !fill.completed.has(step);
}

export function descriptionRuns(fill: EnrichFill): boolean {
  if (!fill.fill) return bought(fill, "description");
  if (!bought(fill, "description")) return false;
  if (fill.overwrite.has("description")) return true;
  for (const step of fill.earlier) {
    if (EARLIER_THAN_DESCRIPTION.has(step)) return true;
  }
  if (explicitBuy(fill)) return true;
  return !fill.completed.has("description");
}

export function embeddingRuns(fill: EnrichFill, descriptionRan: boolean): boolean {
  if (!fill.fill) return bought(fill, "embedding");
  if (!bought(fill, "embedding")) return false;
  if (fill.overwrite.has("embedding")) return true;
  if (descriptionRan) return true;
  if (explicitBuy(fill)) return true;
  return !fill.completed.has("embedding");
}

function asSteps(raw: unknown): Set<FillStep> {
  const out = new Set<FillStep>();
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (FILL_STEPS.includes(item as FillStep)) out.add(item as FillStep);
  }
  return out;
}

/** The completed set frozen on the run at its first read. Null when this
 *  run has not snapshotted yet. An empty array is a real snapshot. */
export function completedSnapshot(raw: unknown): Set<FillStep> | null {
  if (!Array.isArray(raw)) return null;
  return asSteps(raw);
}

/** Writes the run row, not the place. Kept above any place_profiles read:
 *  the write-surface scan looks 2000 chars forward from a `.from()` and
 *  would otherwise call this a profile writer. */
async function freezeCompleted(
  admin: SupabaseClient,
  runId: string,
  meta: Record<string, unknown>,
  completed: ReadonlySet<FillStep>,
): Promise<void> {
  const { error } = await admin
    .from("place_enrichment_runs")
    .update({ meta: { ...meta, completed: [...completed] } })
    .eq("id", runId);
  if (error) console.error("[enrich-fill] completed snapshot:", error.message);
}

export async function loadEnrichFill(
  admin: SupabaseClient,
  row: {
    place_id: string;
    run_id: string | null;
    subprocesses: SubprocessKey[] | null;
    gathered: { stepsRan?: string[] } | null;
  },
): Promise<EnrichFill> {
  let fill = false;
  const overwrite = new Set<FillStep>();
  let meta: Record<string, unknown> | null = null;
  if (row.run_id) {
    const { data, error } = await admin
      .from("place_enrichment_runs")
      .select("meta")
      .eq("id", row.run_id)
      .maybeSingle();
    if (!error && data) {
      meta = (data.meta ?? {}) as Record<string, unknown>;
      fill = meta.fill === true;
      const parsed = parseOverwrite(meta.overwrite);
      if (Array.isArray(parsed)) {
        for (const step of parsed) overwrite.add(step);
      }
      const frozen = fill ? completedSnapshot(meta.completed) : null;
      if (frozen) {
        return {
          fill,
          overwrite,
          completed: frozen,
          earlier: asSteps(row.gathered?.stepsRan),
          subprocesses: row.subprocesses,
        };
      }
    }
  }
  const completed = new Set<FillStep>();
  if (fill && row.run_id && meta && !Array.isArray(meta.completed)) {
    const { data, error } = await admin
      .from("place_profiles")
      .select("enrichment")
      .eq("id", row.place_id)
      .maybeSingle();
    // A failed read is not "everything is filled". Leave completed empty so
    // the run redoes the steps it bought rather than skipping them.
    if (!error) {
      const stored = (data?.enrichment ?? null) as EnrichmentMap | null;
      const functions = foldFunctionStateMap(stored?.functions ?? {});
      for (const step of FILL_STEPS) {
        if (functions[step]?.state === "completed") completed.add(step);
      }
    }
    // Freeze this set on the run before any stage stamps. A retry that
    // re-read the live map would treat this run's own stamps as already
    // done, skip the work, and then let write strip the columns.
    await freezeCompleted(admin, row.run_id, meta, completed);
  }
  return {
    fill,
    overwrite,
    completed,
    earlier: asSteps(row.gathered?.stepsRan),
    subprocesses: row.subprocesses,
  };
}

/** Columns a skipped step must not send onward, so contents cannot clobber them. */
export const STEP_WRITE_KEYS: Record<FillStep, readonly string[]> = {
  details: [
    "price_level",
    "lat",
    "lng",
    "address",
    "zone",
    "city",
    "timezone",
    "closes_at",
    "hours",
    "phone",
    "google_maps_url",
    "business_state",
    // Google spine text and the channels Links does not discover. They ride
    // in on `place = { ...basics }`. A skipped Details must not persist them,
    // nulls included.
    "pitch",
    "story",
    "x_url",
    "threads_url",
    "reddit_url",
    "resy_url",
    "didi_food_url",
  ],
  serp: [],
  links: [
    "facebook_url",
    "opentable_url",
    "uber_eats_url",
  ],
  // Follower counts and stars are the Reviews verifier, not this step.
  // facebook_rating is a dropped column; a blob that still carries it must
  // be stripped or the profile write refuses the whole patch.
  social: ["facebook_rating"],
  reviews: ["google_reviews"],
  images: ["photos"],
  description: [
    "description",
    "category",
    "category_label",
    "tags",
    "reservations_enabled",
    "name",
    "family_keys",
    "embedding_source_text",
  ],
  embedding: [],
};

export function omitUnrunKeys(
  place: Record<string, unknown>,
  ran: ReadonlySet<FillStep>,
): void {
  for (const step of FILL_STEPS) {
    if (ran.has(step)) continue;
    for (const key of STEP_WRITE_KEYS[step]) delete place[key];
  }
  // Google's website is Details; a discovered website is Links.
  if (!ran.has("details") && !ran.has("links")) delete place.website_url;
  // Links finds the handle; Social is what verifies it.
  if (!ran.has("links") && !ran.has("social")) delete place.instagram_url;
}

function nonempty(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Social's handle when Links did not run this time. A skipped Links step
 *  must scrape the URL already stored, not this fetch's Google copy, which
 *  is often empty and would overwrite the discovered one. */
export function channelForSocial(
  linksRun: boolean,
  google: unknown,
  stored: unknown,
  prior: unknown,
): string | null {
  const fromGoogle = nonempty(google);
  if (linksRun) return fromGoogle;
  return nonempty(stored) ?? nonempty(prior) ?? fromGoogle;
}

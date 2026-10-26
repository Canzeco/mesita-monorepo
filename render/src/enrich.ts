import {
  describeFromFacts,
  fetchGooglePhotoUrls,
  fetchGooglePlace,
  fetchTimezone,
  profileFromGoogle,
} from "./google-spine.ts";
import { digest, embedPair, embeddingFacts, embeddingFields } from "./embedding.ts";
import {
  defaultImageKnobs,
  fetchInstagramPosts,
  rankGallery,
  rankPostsByLikes,
  type ImageKnobs,
  type PhotoAnalysis,
} from "./images.ts";
import { discoverLinks, linkCounts, type LinkField } from "./links.ts";
import { fetchDraftSync } from "./draft-sync.ts";
import { scoutPlace } from "./scout.ts";
import type { RanSteps } from "./steps.ts";

// Paid vendor calls must not be replayed by the platform.
export const NO_RETRY = { maxRetries: 0, waitDurationMs: 1000, backoffScaling: 1 };
export const DAY = 86400;
// Two places at a time. Each one already calls Google and, when needed, OpenAI.
export const AT_ONCE = 2;

export type EnrichmentKnobs = {
  discoverWebsiteN?: number;
  discoverInstagramN?: number;
  discoverFacebookN?: number;
  discoverOpentableN?: number;
  discoverUbereatsN?: number;
  perplexityPreset?: string;
  scoutInstructions?: string;
  resolverInstructions?: string;
  gatherGoogleImages?: number;
  gatherInstagramDepth?: number;
  analyzeGoogleImages?: number;
  analyzeInstagramImages?: number;
  saveTotalImages?: number;
  visionEnabled?: boolean;
  saveImagesToStorage?: boolean;
  imageAnalysisPrompt?: string;
  imageSortingPrompt?: string;
  visionModel?: string;
  sortModel?: string;
};

export type EnrichJob = {
  placeId: string;
  googlePlaceId: string;
  knobs?: EnrichmentKnobs;
  /** Profile at the moment enriching was marked. The write refuses a newer row. */
  baseUpdatedAt?: string | null;
  /** The Scout's message for this place, built by the Edge Function. A job
   *  without one skips step 2. */
  scoutInput?: string;
};
// There is one Enrich (MESITA-2799): every job runs the whole ladder and
// replaces what it finds. A job from an older caller may still carry `depth`
// or `overwrite`; neither is read.

export type BuiltEnrichment = {
  closed?: false;
  patch: Record<string, unknown>;
  mirrorPhotos: boolean;
  photoAnalyses: PhotoAnalysis[];
  /** Steps whose outcome only the task saw (the Scout and Links). */
  steps: RanSteps;
  /** The Scout's read: the write's Presentation grounds on it. Never a column. */
  serpSummary: string | null;
};

/** A listing Google calls permanently closed. The run stops at Details. */
export type ClosedListing = { closed: true };

/** Liveness, step 1's subprocess: read off the same Place Details response. */
export function isPermanentlyClosed(details: { businessStatus?: string }): boolean {
  return details.businessStatus?.trim().toUpperCase() === "CLOSED_PERMANENTLY";
}

// A finished place is the Google spine, the Scout's read of the web, the
// official links Firecrawl sourced and the Resolver kept, the gallery the
// Enrichment page asked for, the 100 newest Google reviews from Apify, and a
// description of at most 500 characters. The description is Google's own
// summary when it has one, otherwise one written from those facts. The write
// then infers the Mesita categories (1–3) and Mesita tags from the saved row
// on every run, and writes the synthesized presentation. A listing Google calls permanently
// closed stops right after Details, before any paid step. Anything else short
// of a finished profile throws before the write. Places itself never supplies
// the review list: it returns five.
export async function buildEnrichment(job: EnrichJob): Promise<BuiltEnrichment | ClosedListing> {
  const googlePlaceId = job.googlePlaceId?.trim() ?? "";
  if (!job.placeId?.trim() || !googlePlaceId) {
    throw new Error("Enrichment needs a place id and a Google place id.");
  }
  const googleKey = process.env.GMP_KEY?.trim() ?? "";
  if (!googleKey) throw new Error("Render is missing GMP_KEY");

  const details = await fetchGooglePlace(googlePlaceId, googleKey);
  if (isPermanentlyClosed(details)) return { closed: true };
  const spine = profileFromGoogle(details, googlePlaceId);
  if (!spine.ok) throw new Error(spine.error);
  const lat = spine.patch.lat;
  const lng = spine.patch.lng;
  if (typeof lat === "number" && typeof lng === "number") {
    const timezone = await fetchTimezone(lat, lng, googleKey);
    if (timezone) spine.patch.timezone = timezone;
  }
  const name = typeof spine.patch.google_name === "string" ? spine.patch.google_name : "";
  const city = typeof spine.patch.city === "string" ? spine.patch.city : null;
  const knobs = job.knobs ?? {};
  const counts = linkCounts({
    website_url: knobs.discoverWebsiteN,
    instagram_url: knobs.discoverInstagramN,
    facebook_url: knobs.discoverFacebookN,
    opentable_url: knobs.discoverOpentableN,
    uber_eats_url: knobs.discoverUbereatsN,
  });
  const scout = job.scoutInput?.trim()
    ? await scoutPlace({
      input: job.scoutInput,
      instructions: knobs.scoutInstructions,
      preset: knobs.perplexityPreset,
      perplexityKey: process.env.PERPLEXITY_KEY,
    })
    : null;
  const discovered = await discoverLinks({
    name,
    city,
    // Every link is looked for again; one the Resolver keeps replaces the saved one.
    have: {},
    counts,
    preset: knobs.perplexityPreset,
    instructions: knobs.resolverInstructions,
    context: scout?.summary ?? null,
    firecrawlKey: process.env.FIRECRAWL_KEY,
    perplexityKey: process.env.PERPLEXITY_KEY,
  });
  const links = discovered.links;
  for (const [key, url] of Object.entries(links) as [LinkField, string][]) {
    spine.patch[key] = url;
  }
  Object.assign(spine.patch, await fetchDraftSync({
    googlePlaceId,
    instagramUrl: stringField(spine.patch.instagram_url),
    facebookUrl: stringField(spine.patch.facebook_url),
  }));

  const openaiKey = process.env.OPENAI_KEY?.trim() ?? "";
  const images = imageKnobs(knobs);
  const instagramUrl = stringField(spine.patch.instagram_url);
  const posts = await fetchInstagramPosts({
    instagramUrl,
    depth: knobs.gatherInstagramDepth ?? 10,
    apifyKey: process.env.APIFY_KEY,
  });
  const photos = await rankGallery({
    google: await fetchGooglePhotoUrls(details.photos, googleKey, images.gatherGoogleImages),
    instagram: rankPostsByLikes(posts),
    knobs: images,
    openaiKey,
  });
  if (photos.urls.length > 0) spine.patch.photos = photos.urls;

  let description = spine.description;
  if (!description) {
    if (!openaiKey) throw new Error("Google has no summary and Render is missing OPENAI_KEY");
    description = await describeFromFacts(factsWithLinks(spine.facts, links), openaiKey);
  }
  if (!description) throw new Error("The place has no description, so it was not written.");

  const patch: Record<string, unknown> = commitPatch({
    ...spine.patch,
    content_state: "ready",
    enriched_at: new Date().toISOString(),
  });
  if (openaiKey && name) {
    const facts = embeddingFacts({
      name,
      zone: typeof spine.patch.zone === "string" ? spine.patch.zone : null,
      city: typeof spine.patch.city === "string" ? spine.patch.city : null,
      address: typeof spine.patch.address === "string" ? spine.patch.address : null,
      description,
    });
    const vectors = await embedPair(facts, name, openaiKey);
    const fields = embeddingFields(
      vectors.summary,
      vectors.name,
      await digest(facts),
      await digest(name),
      facts,
    );
    if (fields) Object.assign(patch, fields);
  }
  const steps: RanSteps = { links: discovered.report };
  if (scout) steps.serp = scout.report;
  return {
    patch,
    mirrorPhotos: knobs.saveImagesToStorage !== false,
    photoAnalyses: photos.analyses,
    steps,
    serpSummary: scout?.summary ?? null,
  };
}

function imageKnobs(knobs: EnrichmentKnobs): ImageKnobs {
  const base = defaultImageKnobs();
  const gatherGoogleImages = countOr(knobs.gatherGoogleImages, base.gatherGoogleImages);
  return {
    ...base,
    gatherGoogleImages,
    analyzeGoogleImages: countOr(knobs.analyzeGoogleImages, gatherGoogleImages),
    analyzeInstagramImages: countOr(knobs.analyzeInstagramImages, base.analyzeInstagramImages),
    saveTotalImages: countOr(knobs.saveTotalImages, base.saveTotalImages),
    visionEnabled: knobs.visionEnabled !== false,
    imageAnalysisPrompt: knobs.imageAnalysisPrompt?.trim() || base.imageAnalysisPrompt,
    imageSortingPrompt: knobs.imageSortingPrompt?.trim() || base.imageSortingPrompt,
    visionModel: knobs.visionModel?.trim() || base.visionModel,
    sortModel: knobs.sortModel?.trim() || base.sortModel,
  };
}

function countOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function factsWithLinks(facts: string, links: Partial<Record<LinkField, string>>): string {
  const lines = Object.entries(links).map(([key, url]) => `${key}: ${url}`);
  return lines.length ? `${facts}\n${lines.join("\n")}` : facts;
}

/** Columns the write EF infers (MESITA-2790); Render's patch never carries them. */
const MESITA_OWNED = ["category", "category_label", "mesita_categories", "tags"] as const;

/** What the run commits. A fresh value replaces the saved one; an empty one
 *  (null, blank, an empty list) is dropped, so a step that found nothing or
 *  failed never blanks a filled column (MESITA-2799). */
export function commitPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if ((MESITA_OWNED as readonly string[]).includes(key)) continue;
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    next[key] = value;
  }
  return next;
}

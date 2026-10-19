import {
  describeFromFacts,
  fetchGooglePhotoUrls,
  fetchGooglePlace,
  fetchTimezone,
  profileFromGoogle,
  type GooglePlace,
  type GoogleSpine,
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
import { applyOverwrite } from "./fill-existing.ts";
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

/** Quick is Google's record. Full is links, Instagram, reviews, vision, and a description. */
export type EnrichDepth = "quick" | "full";

export type EnrichJob = {
  placeId: string;
  googlePlaceId: string;
  knobs?: EnrichmentKnobs;
  /** Absent is Full, so an older caller does not become Quick. */
  depth?: EnrichDepth;
  /** False fills only empty fields and keeps saved links. True may replace. */
  overwrite?: boolean;
  /** Profile at the moment enriching was marked. The write refuses a newer row. */
  baseUpdatedAt?: string | null;
  saved?: Record<string, unknown>;
  /** The Scout's message for this place, built by the Edge Function. Strong
   *  runs the Scout with it; a job without one skips step 2. */
  scoutInput?: string;
};

export function isQuickEnrich(job: EnrichJob): boolean {
  return job.depth === "quick";
}

export type BuiltEnrichment = {
  closed?: false;
  patch: Record<string, unknown>;
  mirrorPhotos: boolean;
  photoAnalyses: PhotoAnalysis[];
  /** Steps whose outcome only the task saw (the Scout and Links, Strong only). */
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
// then fills one Atlas category and Atlas tags, and replaces an empty
// presentation with the synthesized one. A listing Google calls permanently
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
  const overwrite = job.overwrite === true;
  const saved = job.saved ?? {};
  if (isQuickEnrich(job)) {
    return buildQuickEnrichment({
      details,
      spine,
      googleKey,
      knobs,
      overwrite,
      saved,
      name,
      googlePlaceId,
    });
  }
  const counts = linkCounts({
    website_url: knobs.discoverWebsiteN,
    instagram_url: knobs.discoverInstagramN,
    facebook_url: knobs.discoverFacebookN,
    opentable_url: knobs.discoverOpentableN,
    uber_eats_url: knobs.discoverUbereatsN,
  });
  if (!overwrite) {
    for (const key of ["website_url", "instagram_url", "facebook_url", "opentable_url", "uber_eats_url"] as const) {
      const savedUrl = stringField(saved[key]);
      if (savedUrl) spine.patch[key] = savedUrl;
    }
  }
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
    have: {
      website_url: heldLink(overwrite, saved.website_url, spine.patch.website_url),
      instagram_url: heldLink(overwrite, saved.instagram_url, spine.patch.instagram_url),
      facebook_url: heldLink(overwrite, saved.facebook_url, spine.patch.facebook_url),
      opentable_url: heldLink(overwrite, saved.opentable_url, spine.patch.opentable_url),
      uber_eats_url: heldLink(overwrite, saved.uber_eats_url, spine.patch.uber_eats_url),
    },
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

  // The write fills the Presentation when this run may replace it. A saved
  // one stays on the patch through applyOverwrite and is left alone.
  const draft: Record<string, unknown> = {
    ...spine.patch,
    content_state: "ready",
    enriched_at: new Date().toISOString(),
  };
  if (!overwrite && typeof saved.description === "string" && saved.description.trim()) {
    draft.description = saved.description;
  }
  const patch: Record<string, unknown> = applyOverwrite({
    overwrite,
    saved,
    patch: draft,
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
    patch: stampOverwrite(patch, overwrite),
    mirrorPhotos: knobs.saveImagesToStorage !== false,
    photoAnalyses: photos.analyses,
    steps,
    serpSummary: scout?.summary ?? null,
  };
}

/** The mode that produced this commit. Not a preference for the next run. */
export function stampOverwrite(
  patch: Record<string, unknown>,
  overwrite: boolean,
): Record<string, unknown> {
  const current = patch.source_sync;
  const sync = current && typeof current === "object" && !Array.isArray(current)
    ? { ...(current as Record<string, unknown>) }
    : {};
  return { ...patch, source_sync: { ...sync, overwrite } };
}

/** Google's record, then the same Sync the Reviews button uses, in the draft. */
export function quickPatch(opts: {
  spine: Record<string, unknown>;
  description: string | null;
  photos: string[];
  now: string;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    ...opts.spine,
    content_state: "ready",
    enriched_at: opts.now,
  };
  if (opts.description) patch.description = opts.description;
  if (opts.photos.length > 0) patch.photos = opts.photos;
  return patch;
}

async function buildQuickEnrichment(opts: {
  details: GooglePlace;
  spine: Extract<GoogleSpine, { ok: true }>;
  googleKey: string;
  knobs: EnrichmentKnobs;
  overwrite: boolean;
  saved: Record<string, unknown>;
  name: string;
  googlePlaceId: string;
}): Promise<BuiltEnrichment> {
  const images = imageKnobs(opts.knobs);
  let photos: string[] = [];
  try {
    photos = await fetchGooglePhotoUrls(opts.details.photos, opts.googleKey, images.gatherGoogleImages);
  } catch {
    photos = [];
  }
  const description = opts.spine.description;
  const patch = applyOverwrite({
    overwrite: opts.overwrite,
    saved: opts.saved,
    patch: quickPatch({
      spine: opts.spine.patch,
      description,
      photos,
      now: new Date().toISOString(),
    }),
  });
  const openaiKey = process.env.OPENAI_KEY?.trim() ?? "";
  const written = typeof patch.description === "string" ? patch.description : "";
  if (openaiKey && opts.name && written) {
    try {
      const facts = embeddingFacts({
        name: opts.name,
        zone: typeof opts.spine.patch.zone === "string" ? opts.spine.patch.zone : null,
        city: typeof opts.spine.patch.city === "string" ? opts.spine.patch.city : null,
        address: typeof opts.spine.patch.address === "string" ? opts.spine.patch.address : null,
        description: written,
      });
      const vectors = await embedPair(facts, opts.name, openaiKey);
      const fields = embeddingFields(
        vectors.summary,
        vectors.name,
        await digest(facts),
        await digest(opts.name),
        facts,
      );
      if (fields) Object.assign(patch, fields);
    } catch {
      // Quick still writes Google's record when the vectors fail.
    }
  }
  const synced = await fetchDraftSync({
    googlePlaceId: opts.googlePlaceId,
    instagramUrl: stringField(patch.instagram_url),
    facebookUrl: stringField(patch.facebook_url),
  });
  const merged = applyOverwrite({
    overwrite: opts.overwrite,
    saved: opts.saved,
    patch: { ...patch, ...synced },
  });
  return {
    patch: stampOverwrite(merged, opts.overwrite),
    mirrorPhotos: opts.knobs.saveImagesToStorage !== false,
    photoAnalyses: [],
    steps: {},
    serpSummary: null,
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

/** Off keeps a saved link so discovery does not hunt a different one. */
function heldLink(overwrite: boolean, saved: unknown, fresh: unknown): string | null {
  if (overwrite) return null;
  return stringField(saved) ?? stringField(fresh);
}

function factsWithLinks(facts: string, links: Partial<Record<LinkField, string>>): string {
  const lines = Object.entries(links).map(([key, url]) => `${key}: ${url}`);
  return lines.length ? `${facts}\n${lines.join("\n")}` : facts;
}

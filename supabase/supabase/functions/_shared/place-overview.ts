// The one read the place screen paints from (MESITA-2180), shared by
// admin-web-get-overview (super-admin, web-admin) and business-web-get-place
// (whoever runs the place, or a super-admin, web-business) since MESITA-3103.
//
// One round trip: the place row, its enrichment map, Profile Stats (guests
// already see those counts, MESITA-3205), and the vocabulary Family and
// Category resolve against. `internal` adds what only Mesita staff see: the
// embedding, Google's id, the Enrich ladder and function states, and who runs
// the place (owners, pending requests). An owner's read never carries them.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { PLACE_PROFILE_COLUMNS } from "./place-columns.ts";
import { readOperatorFields } from "./operator-fields.ts";
import { isPlaceEnriched, isPlaceListed, isPlaceRequested, isPlaceSeeded } from "./place-state.ts";
import { loadRequestThreshold } from "./place-requests.ts";
import { CRENUP_LABELS_IN_ORDER, CRENUP_TOTAL } from "./crenup-ladder.ts";
import type { EnrichmentMap, FunctionState } from "./schema-catalog.ts";
import { operatorFunctionStates } from "./schema-catalog.ts";
import { fetchPlaceCategories, fetchPlaceFamilies } from "./categories.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { resolveStoredFamily } from "./profile-family.ts";
import { fetchPlaceTags, TAG_FACETS } from "./tags.ts";
import { reviewFoundFromRow } from "./review-found.ts";
import { photoAnalysisMap, photoSourceMap } from "./photo-analysis.ts";
import { loadEnrichmentConfig } from "./enrichment-config.ts";
import { fetchPlaceProfileStats } from "./place-activity-stats.ts";
import { familyChips } from "./catalog-families.ts";
import { listPlaceOwners } from "./place-access.ts";

// The Embeddings card (MESITA-720) reads these. Never part of the public
// column set: a heavy field only staff screens need.
const PLACE_ADMIN_EMBEDDING_COLUMNS = ", embedding, embedding_source_text";

// State (MESITA-1186). The State box answers `seeded` off the identity spine,
// so the read needs Google's id. It must never widen PLACE_PUBLIC_COLUMNS.
const PLACE_ADMIN_STATE_COLUMNS = ", google_place_id";

export type PlaceOverview = {
  place: Record<string, unknown>;
  profile: Record<string, unknown>;
};

export type PlaceOverviewResult =
  | { ok: true; overview: PlaceOverview }
  | { ok: false; status: 404 | 500; error: string };

export async function buildPlaceOverview(
  admin: SupabaseClient,
  placeId: string,
  opts: { internal: boolean },
): Promise<PlaceOverviewResult> {
  const { internal } = opts;
  // `enrichment` is read off `place_profiles` directly, not `profiles` — it is
  // deliberately NOT in the profiles view's column list (adding it means
  // rebuilding the view's two INSTEAD OF triggers).
  const [placeRow, enrichmentRow, categories, families, tags, requestThreshold, assetsRow, profileStats] =
    await Promise.all([
      admin
        .from("profiles")
        .select(
          PLACE_PROFILE_COLUMNS + (internal ? PLACE_ADMIN_EMBEDDING_COLUMNS : "") + PLACE_ADMIN_STATE_COLUMNS,
        )
        .eq("id", placeId)
        .maybeSingle(),
      admin
        .from("place_profiles")
        .select("enrichment, google_found, instagram_found, facebook_found, enrichment_sources, profile_photo")
        .eq("id", placeId)
        .maybeSingle(),
      fetchPlaceCategories(admin),
      fetchPlaceFamilies(admin),
      fetchPlaceTags(admin),
      loadRequestThreshold(admin),
      admin
        .from("place_media_assets")
        .select("public_url, source_url, analysis_text, source")
        .eq("place_id", placeId),
      fetchPlaceProfileStats(admin, placeId),
    ]);
  if (placeRow.error) return { ok: false, status: 500, error: placeRow.error.message };
  if (!placeRow.data) return { ok: false, status: 404, error: "Place not found" };
  // Family and Category cannot paint without the vocabulary. An empty list is
  // the fetchers' error posture; a half profile is the bug this read exists
  // to stop.
  if (categories.length === 0 || families.length === 0) {
    return { ok: false, status: 500, error: "Profile vocabulary unavailable" };
  }
  const placeFields = placeRow.data as unknown as Record<string, unknown>;

  // Best effort: a missing/null map falls back to the CREATED-floor default,
  // which reads as 0 — the State box and the catalog table MUST show the same
  // number either way.
  if (enrichmentRow.error) {
    console.error("[place-overview] place_profiles.enrichment:", enrichmentRow.error.message);
  }
  if (assetsRow.error) {
    console.error("[place-overview] place_media_assets:", assetsRow.error.message);
  }
  const enrichmentMap = (enrichmentRow.data?.enrichment as EnrichmentMap | null) ??
    { functions: {}, highWater: 0, blockedAt: null };

  // The pipeline facts of State ride along computed, never stored — the same
  // helpers admin-web-search-places uses, so the box and the table can never
  // disagree. `name` is the Mesita name (MESITA-2828).
  const place: Record<string, unknown> = {
    ...placeFields,
    // The Preview's Mesita Families box (MESITA-2924), as the guest sees it.
    families: familyChips(placeFields.family_keys),
    seeded: isPlaceSeeded(placeFields.google_place_id),
    listed: isPlaceListed(placeFields.state),
    requested: isPlaceRequested({
      requestCount: placeFields.request_count,
      enrichedAt: placeFields.enriched_at,
    }),
    request_threshold: requestThreshold,
    // THE Enriched fact (MESITA-2154).
    enriched: isPlaceEnriched(placeFields.enriched_at),
    // The Basics fields an edit owns (MESITA-2829): Enrich skips them until
    // the row's Reset clears the mark.
    operator_fields: readOperatorFields(enrichmentRow.data?.enrichment_sources),
    ...reviewFoundFromRow((enrichmentRow.data ?? {}) as Record<string, unknown>),
    photo_analysis: photoAnalysisMap(assetsRow.data),
    // Profile's photo view (MESITA-3519): where each photo came from.
    photo_source: photoSourceMap(assetsRow.data),
    // The place's own pick (MESITA-3528), null while it follows the cover;
    // profile_photo above is what guests see.
    profile_photo_pick: (enrichmentRow.data as { profile_photo?: string | null } | null)?.profile_photo ?? null,
    profile_stats: profileStats,
  };

  if (internal) {
    // The prompts the Images step runs today (MESITA-3519): the Analysis
    // prompt wrote each photo's description, the Sorting prompt read them all
    // and returned one order. Staff only; the config is Mesita's.
    const config = await loadEnrichmentConfig(admin);
    place.photo_prompts = {
      analysis: config.enrichImageAnalysisPrompt,
      sorting: config.enrichImageSortingPrompt,
      vision: config.enrichImageVisionEnabled,
    };
    place.enrich_crenup = enrichmentMap.highWater;
    place.enrich_crenup_total = CRENUP_TOTAL;
    place.enrich_crenup_labels = CRENUP_LABELS_IN_ORDER;
    // WHY it stopped, beside where: function 1 can FAIL a place Google
    // reports permanently closed, so 0 carries two different facts.
    place.enrich_crenup_blocked = enrichmentMap.blockedAt;
    place.enrich_functions = operatorFunctionStates(
      enrichmentMap.functions as Partial<Record<string, FunctionState>>,
    );
    // Who runs this place (MESITA-3103): staff see it beside State.
    const owners = await listPlaceOwners(admin, placeId);
    place.owners = owners.owners;
    place.pending_requests = owners.pending;
  } else {
    // Google's id is staff-only; `seeded` above already answered from it.
    delete place.google_place_id;
  }

  const profile = {
    // The stored families (MESITA-2891), named for the row; `place.family_keys`
    // carries the slugs the Basics editor toggles (MESITA-2893).
    familyStored: resolveStoredFamily(placeFields.family_keys, families),
    // The ones the editor offers, in catalog (day-arc) order; Undefined is
    // never a pick.
    families: families
      .filter((f) => f.slug !== "undefined")
      .map((f) => ({ slug: f.slug, label: f.label, emoji: f.emoji, sortOrder: f.sort_order })),
    categories,
    tags,
    facets: TAG_FACETS,
    fieldLimits: ENRICH_FIELD_LIMITS,
  };

  return { ok: true, overview: { place, profile } };
}

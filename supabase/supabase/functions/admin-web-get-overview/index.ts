// Supabase Edge Function — admin-web-get-overview
//
// Super-admin only. The full place row admin's Single Place edits
// (manage-single/[id]), plus the State facts its State and Crenup boxes read,
// in one round trip.
//
// WAS business-web-get-overview (MESITA-2090). That function served three
// readers — the deleted web-business sidebar, its Place screen, and, through
// its super-admin branch, this admin screen. MESITA-2089 deleted web-business,
// so only the
// super-admin branch survives, under the name of the one app that calls it:
// the EF name is the ACL (ef-caller-acl.test.ts). Gone with the business
// readers: the place_members branch, recent tickets, `rewardsConfig`, the
// Check PIN, and the Mesita Pay / Credits / orders acceptance bits — no admin
// screen reads any of them.
//
// Body:     { placeId }   (legacy aliases via readPlaceIdAlias)
// Response: { ok: true, isSuperAdmin: true, active: { place }, profile }
//           `active.place` is the AdminPlace. `profile` is the rest of the
//           same read: the stored Families resolved, the category
//           options (each with its family display), the tag catalog, and
//           the field limits. The profile page does not call another door.
// Auth:     caller must be in public.super_admins.
//
// Local:  supabase functions serve admin-web-get-overview
// Deploy: supabase functions deploy admin-web-get-overview

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  json,
  readJsonOr,
  readPlaceIdAlias,
  serveJson,
} from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { readOperatorFields } from "../_shared/operator-fields.ts";
import {
  isPlaceEnriched,
  isPlaceListed,
  isPlaceRequested,
  isPlaceSeeded,
} from "../_shared/place-state.ts";
import { loadRequestThreshold } from "../_shared/place-requests.ts";
import { CRENUP_LABELS_IN_ORDER, CRENUP_TOTAL } from "../_shared/crenup-ladder.ts";
import type { EnrichmentMap, FunctionState } from "../_shared/schema-catalog.ts";
import { operatorFunctionStates } from "../_shared/schema-catalog.ts";
import { fetchPlaceCategories, fetchPlaceFamilies } from "../_shared/categories.ts";
import { ENRICH_FIELD_LIMITS } from "../_shared/enrich-field-limits.ts";
import {
  resolveStoredFamily,
} from "../_shared/profile-family.ts";
import { fetchPlaceTags, TAG_FACETS } from "../_shared/tags.ts";
import { reviewFoundFromRow } from "../_shared/review-found.ts";
import { photoAnalysisMap } from "../_shared/photo-analysis.ts";
import { fetchPlaceProfileStats } from "../_shared/place-activity-stats.ts";
import { familyChips } from "../_shared/catalog-families.ts";

// The Embeddings card (MESITA-720) reads these. Never part of the public
// column set: a heavy field only this screen and admin-web-search-places need.
const PLACE_ADMIN_EMBEDDING_COLUMNS =
  ", embedding, embedding_source_text";

// State (MESITA-1186). The State box answers `seeded` off the identity spine,
// so the read needs Google's id. It must never widen PLACE_PUBLIC_COLUMNS.
const PLACE_ADMIN_STATE_COLUMNS = ", google_place_id";

type Body = {
  placeId?: string;
};

serveJson("admin-web-get-overview", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body) || null;
  if (!placeId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  // One round trip: the place row, its enrichment map, and the vocabulary
  // Family and Category resolve against. The profile page paints from this
  // response alone (MESITA-2180). `enrichment` is read off `place_profiles`
  // directly, not `profiles` — it is deliberately NOT in the profiles view's
  // column list (adding it means rebuilding the view's two INSTEAD OF triggers).
  const [placeRow, enrichmentRow, categories, families, tags, requestThreshold, assetsRow, profileStats] =
    await Promise.all([
    admin
      .from("profiles")
      .select(
        PLACE_PROFILE_COLUMNS + PLACE_ADMIN_EMBEDDING_COLUMNS + PLACE_ADMIN_STATE_COLUMNS,
      )
      .eq("id", placeId)
      .maybeSingle(),
    admin
      .from("place_profiles")
      .select("enrichment, google_found, instagram_found, facebook_found, enrichment_sources")
      .eq("id", placeId)
      .maybeSingle(),
    fetchPlaceCategories(admin),
    fetchPlaceFamilies(admin),
    fetchPlaceTags(admin),
    loadRequestThreshold(admin),
    admin
      .from("place_media_assets")
      .select("public_url, source_url, analysis_text")
      .eq("place_id", placeId),
    fetchPlaceProfileStats(admin, placeId),
  ]);
  if (placeRow.error) {
    return json({ ok: false, error: placeRow.error.message }, 500);
  }
  if (!placeRow.data) {
    return json({ ok: false, error: "Place not found" }, 404);
  }
  // Family and Category cannot paint without the vocabulary. An empty list is
  // the fetchers' error posture; a half profile is the bug this read exists
  // to stop.
  if (categories.length === 0 || families.length === 0) {
    return json({ ok: false, error: "Profile vocabulary unavailable" }, 500);
  }
  const placeFields = placeRow.data as unknown as Record<string, unknown>;

  // Best effort: a missing/null map falls back to the CREATED-floor default,
  // which reads as 0 — the State box and the catalog table MUST show the same
  // number either way, a state that disagrees with itself across two screens
  // being worse than no state.
  if (enrichmentRow.error) {
    console.error("[admin-web-get-overview] place_profiles.enrichment:", enrichmentRow.error.message);
  }
  if (assetsRow.error) {
    console.error("[admin-web-get-overview] place_media_assets:", assetsRow.error.message);
  }
  const enrichmentMap = (enrichmentRow.data?.enrichment as EnrichmentMap | null) ??
    { functions: {}, highWater: 0, blockedAt: null };

  // The pipeline facts of State ride along computed, never stored — the same
  // helpers admin-web-search-places uses for the Single Place table, so the
  // box and the table can never disagree. `name` is the Mesita name
  // (MESITA-2828); google_name rides along as Google's own label.
  const place = {
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
    // THE Enriched fact (MESITA-2154) — `enriched_at` set; same helper as
    // admin-web-search-places, so Status and the catalog table agree.
    enriched: isPlaceEnriched(placeFields.enriched_at),
    // Premier (MESITA-2925): `boost_tier` (0..3) rides in from the
    // profile columns; Selected is no longer read.
    // The Basics fields the operator owns (MESITA-2829): Enrich skips them
    // until the row's Reset clears the mark.
    operator_fields: readOperatorFields(enrichmentRow.data?.enrichment_sources),
    enrich_crenup: enrichmentMap.highWater,
    enrich_crenup_total: CRENUP_TOTAL,
    enrich_crenup_labels: CRENUP_LABELS_IN_ORDER,
    // WHY it stopped, beside where: function 1 can FAIL a place Google
    // reports permanently closed, so 0 carries two different facts.
    enrich_crenup_blocked: enrichmentMap.blockedAt,
    enrich_functions: operatorFunctionStates(
      enrichmentMap.functions as Partial<Record<string, FunctionState>>,
    ),
    ...reviewFoundFromRow(
      (enrichmentRow.data ?? {}) as Record<string, unknown>,
    ),
    photo_analysis: photoAnalysisMap(assetsRow.data),
    profile_stats: profileStats,
  };

  const profile = {
    // The stored families (MESITA-2891), named for the row; `place.family_keys`
    // carries the slugs the Basics editor toggles (MESITA-2893).
    familyStored: resolveStoredFamily(placeFields.family_keys, families),
    // The thirty-seven the editor offers, in catalog (day-arc) order; Undefined is
    // never a pick.
    families: families
      .filter((f) => f.slug !== "undefined")
      .map((f) => ({ slug: f.slug, label: f.label, emoji: f.emoji, sortOrder: f.sort_order })),
    categories,
    tags,
    facets: TAG_FACETS,
    fieldLimits: ENRICH_FIELD_LIMITS,
  };

  return json({
    ok: true,
    isSuperAdmin: true,
    active: { place },
    profile,
  });
});

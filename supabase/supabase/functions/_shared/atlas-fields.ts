// The Intaker vocabulary a console needs to render a place editor:
// Super Categories, place categories, tag catalog, facets, field limits.
//
// Two doors, one body (MESITA-1740): `admin-web-get-atlas-fields` is
// requireSuperAdmin; `business-web-get-atlas-fields` is any signed-in
// business caller. Nothing here is place-specific or private — it is the
// same catalog Atlas Config and the Profile editor both read. A copy in
// the second door would drift the caps an operator's editor enforces.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  fetchPlaceCategories,
  fetchPlaceSuperCategories,
} from "./categories.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { fetchPlaceTags, TAG_FACETS } from "./tags.ts";

export async function loadAtlasFields(admin: SupabaseClient) {
  const [categories, superCategories, tags] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceSuperCategories(admin),
    fetchPlaceTags(admin),
  ]);
  return {
    categories,
    superCategories,
    tags,
    facets: TAG_FACETS,
    fieldLimits: ENRICH_FIELD_LIMITS,
    counts: {
      categories: categories.length,
      superCategories: superCategories.length,
      tags: tags.length,
      facets: TAG_FACETS.length,
    },
  };
}

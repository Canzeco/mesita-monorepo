// The Enricher vocabulary a console needs to render a place editor:
// place families, place categories, tag catalog, facets, field limits.
//
// One body (MESITA-1740) behind `admin-web-get-atlas-fields`
// (requireSuperAdmin); its business twin went with the business console
// (MESITA-2090). Nothing here is place-specific or private — it is the same
// catalog Atlas Config and the Profile editor both read, so a copy in a
// second door would drift the caps an operator's editor enforces.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  fetchPlaceCategories,
  fetchPlaceFamilies,
} from "./categories.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { fetchPlaceTags, TAG_FACETS } from "./tags.ts";

export async function loadAtlasFields(admin: SupabaseClient) {
  const [categories, families, tags] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceFamilies(admin),
    fetchPlaceTags(admin),
  ]);
  return {
    categories,
    families,
    tags,
    facets: TAG_FACETS,
    fieldLimits: ENRICH_FIELD_LIMITS,
    counts: {
      categories: categories.length,
      families: families.length,
      tags: tags.length,
      facets: TAG_FACETS.length,
    },
  };
}

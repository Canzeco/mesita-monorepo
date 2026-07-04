import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, logSwallowedEFError } from "./_invoke";

// Controlled tag vocabulary served by the `business-list-tags` Edge Function.
// Clients never read the catalog table directly — every read goes through an
// EF (project rule). The EF returns 17 facets (display groups) and 101 tags,
// each tag carrying the `facet` slug it belongs to.

export type TagFacet = {
  slug: string;
  emoji: string;
  label_es: string;
  label_en: string;
};

export type PlaceTagOption = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string; // matches a TagFacet.slug
  section: string; // "Food & Nightlife" | "Experiences & Wellness" | "Both"
  sort_order: number;
};

type ListPlaceTagsResult = {
  facets: TagFacet[];
  tags: PlaceTagOption[];
};

// Fetches the full tag catalog. Graceful posture (MESITA-28, shared with
// apiListPlaceCategories): degrades to empty arrays on any error so a
// transient EF/network failure leaves the picker empty rather than crashing
// the place form — but the failure is always logged, never silent.
export async function apiListPlaceTags(
  client: SupabaseClient,
): Promise<ListPlaceTagsResult> {
  try {
    const data = await invokeEF<ListPlaceTagsResult>(
      client,
      "business-list-tags",
      {},
    );
    return {
      facets: data.facets ?? [],
      tags: data.tags ?? [],
    };
  } catch (err) {
    logSwallowedEFError(err);
    return { facets: [], tags: [] };
  }
}

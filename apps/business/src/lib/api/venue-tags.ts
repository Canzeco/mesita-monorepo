import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

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

export type VenueTagOption = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string; // matches a TagFacet.slug
  section: string; // "Food & Nightlife" | "Experiences & Wellness" | "Both"
  sort_order: number;
};

type ListVenueTagsResult = {
  facets: TagFacet[];
  tags: VenueTagOption[];
};

// Fetches the full tag catalog. Degrades to empty arrays on any error so a
// transient EF/network failure leaves the picker empty rather than crashing
// the place form (mirrors apiListVenueCategories' graceful posture — though
// here the helper itself swallows the error instead of the caller).
export async function apiListVenueTags(
  client: SupabaseClient,
): Promise<ListVenueTagsResult> {
  try {
    const data = await invokeEF<ListVenueTagsResult>(
      client,
      "business-list-tags",
      {},
    );
    return {
      facets: data.facets ?? [],
      tags: data.tags ?? [],
    };
  } catch {
    return { facets: [], tags: [] };
  }
}

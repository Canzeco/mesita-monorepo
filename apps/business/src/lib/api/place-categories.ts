import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, logSwallowedEFError } from "./_invoke";

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

type ListPlaceCategoriesResult = {
  categories: PlaceCategoryOption[];
};

// Fetches the category catalog. Graceful posture (MESITA-28, shared with
// apiListPlaceTags): degrades to an empty array on any error so a transient
// EF/network failure leaves the selector empty rather than crashing the place
// form — but the failure is always logged, never silent.
export async function apiListPlaceCategories(
  client: SupabaseClient,
): Promise<PlaceCategoryOption[]> {
  try {
    const data = await invokeEF<ListPlaceCategoriesResult>(
      client,
      "business-list-categories",
      {},
    );
    return data.categories ?? [];
  } catch (err) {
    logSwallowedEFError(err);
    return [];
  }
}

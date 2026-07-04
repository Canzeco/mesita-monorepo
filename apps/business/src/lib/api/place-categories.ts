import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

type ListPlaceCategoriesResult = {
  categories: PlaceCategoryOption[];
};

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
  } catch {
    return [];
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

export async function apiListPlaceCategories(
  client: SupabaseClient,
): Promise<PlaceCategoryOption[]> {
  const { data, error } = await client
    .from("place_categories")
    .select("slug, label, section, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PlaceCategoryOption[];
}

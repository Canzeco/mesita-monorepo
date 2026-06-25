import type { SupabaseClient } from "@supabase/supabase-js";

export type VenueCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

export async function apiListVenueCategories(
  client: SupabaseClient,
): Promise<VenueCategoryOption[]> {
  const { data, error } = await client
    .from("venue_categories")
    .select("slug, label, section, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as VenueCategoryOption[];
}

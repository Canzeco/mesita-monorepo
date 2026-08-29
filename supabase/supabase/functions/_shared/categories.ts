// Shared helper — dynamic place-category inference.
//
// Mesita's category vocabulary lives in public.place_categories (migration
// 0061) and is intentionally editable: categories get added or removed over
// time. So nothing here hardcodes the list. Every inference reads the live
// table at run time, hands the candidate slugs to the classifier, and accepts
// the answer only if it is one of those live slugs. Both the create path
// (business-web-create-project) and the enrich path (the Intaker) call this
// so a place's category is always a canonical slug, never free text.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export { inferPlaceCategory } from "./categories-infer.ts";
export { inferPlaceSuperCategories } from "./infer-super-categories.ts";

export type PlaceCategory = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
  super_category_slugs?: string[];
};

export type PlaceSuperCategory = {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
};

// Reads the full, live category vocabulary ordered by sort_order. Returns []
// on error so callers degrade gracefully (keep their prior behaviour) rather
// than failing the whole create/enrich over a category lookup.
export async function fetchPlaceCategories(
  admin: SupabaseClient,
): Promise<PlaceCategory[]> {
  const { data, error } = await admin
    .from("place_categories")
    .select("slug, label, section, sort_order, super_category_slugs")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as PlaceCategory[];
}

export async function fetchPlaceSuperCategories(
  admin: SupabaseClient,
): Promise<PlaceSuperCategory[]> {
  const { data, error } = await admin
    .from("place_super_categories")
    .select("slug, label, emoji, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as PlaceSuperCategory[];
}

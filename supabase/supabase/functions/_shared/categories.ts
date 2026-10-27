// Place category / family vocabulary — live reads of public.place_categories
// and public.place_families.
//
// Mesita's category vocabulary lives in public.place_categories (migration
// 0061) and is intentionally editable: categories get added or removed over
// time. So nothing here hardcodes the list. Every inference reads the live
// table at run time, hands the candidate slugs to the classifier, and accepts
// the answer only if it is one of those live slugs. Both the create path
// (_shared/create-place.ts) and the enrich path (the Enricher) call this
// so a place's category is always a canonical slug, never free text.
// Google categories (MESITA-2827) are Google's canonical type list,
// catalog_membership; fetchGoogleCategories reads it in the same shape.
// Nothing classifies into them any more: a place's Google categories are
// Google's own types (MESITA-2836) and its families their dictionary
// (MESITA-2834); the Create door picks only tags.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { humanizeCategorySlug } from "./parse-utils.ts";

export type PlaceCategory = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
  family_keys?: string[];
};

export type PlaceFamily = {
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
    .select("slug, label, section, sort_order, family_keys")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as PlaceCategory[];
}

export async function fetchPlaceFamilies(
  admin: SupabaseClient,
): Promise<PlaceFamily[]> {
  const { data, error } = await admin
    .from("place_families")
    .select("slug, label, emoji, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as PlaceFamily[];
}

// Google's canonical category list (catalog_membership: the Table A types
// with their families), shaped like a PlaceCategory so the classifier reads
// one shape. [] on error, like the reads above.
export async function fetchGoogleCategories(
  admin: SupabaseClient,
): Promise<PlaceCategory[]> {
  const { data, error } = await admin
    .from("catalog_membership")
    .select("slug, family_keys")
    .order("slug", { ascending: true });
  if (error || !data) return [];
  return (data as { slug: string; family_keys: string[] }[]).map((row, i) => ({
    slug: row.slug,
    label: humanizeCategorySlug(row.slug) ?? row.slug,
    section: "Google",
    sort_order: i,
    family_keys: row.family_keys,
  }));
}

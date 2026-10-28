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
// Google categories are Google's canonical type list, catalog_membership,
// each enabled on Mesita or not (MESITA-2891); fetchGoogleCategories reads it.
// A place's Google categories are Google's own types (MESITA-2836); its
// Mesita Families are the Description step's model pick (MESITA-2891).

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { humanizeCategorySlug } from "./parse-utils.ts";

export type PlaceCategory = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
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
    .select("slug, label, section, sort_order")
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

/** One Google category and whether Mesita serves it (MESITA-2891). */
export type GoogleCategory = { slug: string; label: string; enabled: boolean };

// Google's canonical category list (catalog_membership: the Table A types),
// each enabled on Mesita or not. [] on error, like the reads above.
export async function fetchGoogleCategories(
  admin: SupabaseClient,
): Promise<GoogleCategory[]> {
  const { data, error } = await admin
    .from("catalog_membership")
    .select("slug, enabled")
    .order("slug", { ascending: true });
  if (error || !data) return [];
  return (data as { slug: string; enabled: boolean }[]).map((row) => ({
    slug: row.slug,
    label: humanizeCategorySlug(row.slug) ?? row.slug,
    enabled: row.enabled === true,
  }));
}

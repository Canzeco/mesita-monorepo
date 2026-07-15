"use server";

import { efResult, type EfResult } from "@/lib/supabase-ef";

// ─── Atlas vocabulary (categories, tags, limits) ───────────────────────────
//
// Atlas Config is the profile spec: the controlled vocabulary and field limits
// that the Enricher (and operators) write place profiles with. The Enricher's
// own pipeline behaviour lives on the separate Enricher Config page.

export type AtlasCategory = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

export type AtlasTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
  sort_order: number;
};

export type AtlasTagFacet = {
  slug: string;
  emoji: string;
  label_es: string;
  label_en: string;
};

export type AtlasFieldLimit = {
  max: number;
  note: string;
};

export type AtlasFieldsPayload = {
  categories: AtlasCategory[];
  tags: AtlasTag[];
  facets: AtlasTagFacet[];
  fieldLimits: Record<string, AtlasFieldLimit>;
  counts: { categories: number; tags: number; facets: number };
};

export async function getAtlasFields(): Promise<EfResult<AtlasFieldsPayload>> {
  return efResult<AtlasFieldsPayload>("admin-web-get-atlas-fields", {});
}

"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Atlas vocabulary (categories, tags, limits) ───────────────────────────
//
// Atlas Config is the profile spec: the controlled vocabulary and field limits
// that the Enricher (and operators) write place profiles with. The Enricher's
// own pipeline behaviour lives on the separate Enricher Config page.

type AtlasCategory = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

type AtlasTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
  sort_order: number;
};

type AtlasTagFacet = {
  slug: string;
  emoji: string;
  label_es: string;
  label_en: string;
};

type AtlasFieldLimit = {
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

export async function getAtlasFields(): Promise<
  { ok: true; data: AtlasFieldsPayload } | { ok: false; error: string }
> {
  const r = await efInvoke<AtlasFieldsPayload>("admin-web-get-atlas-fields", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

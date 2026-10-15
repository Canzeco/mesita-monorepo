// The Atlas page payload. Families, categories and tags come from the live
// tables. Google types come from the code map — that record is the
// exclusive side of the taxonomy, and it is not stored twice. Facet chrome
// is presentation and lives with the tag vocabulary.
import type { PlaceCategory, PlaceFamily } from "./categories.ts";
import { GOOGLE_TYPE_SUPER, type GuestSuper } from "./google-type-super.ts";
import { type PlaceTag, TAG_FACETS } from "./tags.ts";

export type FamiliesMapFamily = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type FamiliesMapCategory = {
  slug: string;
  label: string;
  emoji: string;
  familyKeys: string[];
};

export type FamiliesMapGoogleType = {
  slug: string;
  family: GuestSuper;
};

export type FamiliesMapTag = {
  slug: string;
  label: string;
  facet: string;
  facetLabel: string;
  facetEmoji: string;
  sortOrder: number;
};

export type FamiliesMap = {
  families: FamiliesMapFamily[];
  categories: FamiliesMapCategory[];
  googleTypes: FamiliesMapGoogleType[];
  tags: FamiliesMapTag[];
};

const FACET_ORDER = new Map(
  TAG_FACETS.map((facet, index) => [facet.slug, index]),
);
const FACET_BY_SLUG = new Map(TAG_FACETS.map((facet) => [facet.slug, facet]));

export function buildFamiliesMap(
  families: PlaceFamily[],
  categories: PlaceCategory[],
  tags: PlaceTag[] = [],
): FamiliesMap {
  return {
    families: families.map((f) => ({
      slug: f.slug,
      label: f.label,
      emoji: f.emoji,
      sortOrder: f.sort_order,
    })),
    categories: categories.map((c) => ({
      slug: c.slug,
      label: c.label,
      emoji: c.emoji ?? "📍",
      familyKeys: [],
    })),
    googleTypes: Object.entries(GOOGLE_TYPE_SUPER)
      .map(([slug, family]) => ({ slug, family }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
    tags: tags
      .map((tag) => {
        const facet = FACET_BY_SLUG.get(tag.facet);
        return {
          slug: tag.slug,
          label: tag.label_en || tag.slug.replaceAll("_", " "),
          facet: tag.facet,
          facetLabel: facet?.label_en ?? tag.facet,
          facetEmoji: facet?.emoji ?? "",
          sortOrder: tag.sort_order,
        };
      })
      .sort((a, b) => {
        const facet = (FACET_ORDER.get(a.facet) ?? 999) -
          (FACET_ORDER.get(b.facet) ?? 999);
        if (facet !== 0) return facet;
        return a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug);
      }),
  };
}

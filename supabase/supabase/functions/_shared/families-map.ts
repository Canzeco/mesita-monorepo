// The Atlas page payload (MESITA-2891). Pato, 2026-10-27: "Make a list of the
// Google Categories that are enabled on Mesita. And also make a list of all
// the Google Categories that are NOT enabled on Mesita." · "Kill the Google
// Categories vs Mesita Families matrix … Remove it. Delete it."
//
// So: the Mesita Families (the forty the Description step picks from), every
// Google category split by `catalog_membership.enabled`, and the tag catalog.
// No category ↔ family join is returned or stored any more.
import type { GoogleCategory, PlaceFamily } from "./categories.ts";
import { type PlaceTag, TAG_FACETS } from "./tags.ts";

export type FamiliesMapFamily = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type FamiliesMapGoogleCategory = { slug: string; label: string };

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
  /** Google categories enabled on Mesita, by label. */
  enabledCategories: FamiliesMapGoogleCategory[];
  /** Google categories not enabled on Mesita, by label. */
  disabledCategories: FamiliesMapGoogleCategory[];
  tags: FamiliesMapTag[];
};

const FACET_ORDER = new Map(
  TAG_FACETS.map((facet, index) => [facet.slug, index]),
);
const FACET_BY_SLUG = new Map(TAG_FACETS.map((facet) => [facet.slug, facet]));

function byLabel(a: FamiliesMapGoogleCategory, b: FamiliesMapGoogleCategory): number {
  return a.label.localeCompare(b.label) || a.slug.localeCompare(b.slug);
}

export function buildFamiliesMap(
  families: PlaceFamily[],
  googleCategories: GoogleCategory[],
  tags: PlaceTag[] = [],
): FamiliesMap {
  const row = (c: GoogleCategory) => ({ slug: c.slug, label: c.label });
  return {
    families: families
      .filter((f) => f.slug !== "undefined")
      .map((f) => ({
        slug: f.slug,
        label: f.label,
        emoji: f.emoji,
        sortOrder: f.sort_order,
      })),
    enabledCategories: googleCategories.filter((c) => c.enabled).map(row).sort(byLabel),
    disabledCategories: googleCategories.filter((c) => !c.enabled).map(row).sort(byLabel),
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

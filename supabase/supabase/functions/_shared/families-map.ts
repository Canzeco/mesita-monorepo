// The Atlas page payload (MESITA-2891). Pato, 2026-10-27: "Make a list of the
// Google Categories that are enabled on Mesita. And also make a list of all
// the Google Categories that are NOT enabled on Mesita." · "Kill the Google
// Categories vs Mesita Families matrix … Remove it. Delete it."
//
// So: the Mesita Families (the twenty-five the Description step picks from), every
// Google category Mesita allows (`catalog_membership`, the allow-list since
// MESITA-4576), every Google category it does not (MESITA-4680: Google's
// Table A list kept in code, minus the allowed ones and Google's generic
// Table B markers; the database stores none of them), and the tag catalog.
// No category ↔ family join is returned or stored any more.
import type { GoogleCategory, PlaceFamily } from "./categories.ts";
import { type PlaceTag, TAG_FACETS } from "./tags.ts";
import { FAMILY_MEANINGS } from "./families-infer.ts";
import { GOOGLE_TYPE_SUPER } from "./google-type-super.ts";
import { GOOGLE_TABLE_B_TYPES } from "./google-table-b.ts";
import { humanizeCategorySlug } from "./parse-utils.ts";

export type FamiliesMapFamily = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
  /** What the family means to the Description prompt (MESITA-4238); "" if none. */
  meaning: string;
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
  /** The Google categories Mesita allows, by label (MESITA-4576: no other is stored). */
  enabledCategories: FamiliesMapGoogleCategory[];
  /** Every other Google Table A category, by label: read-only documentation (MESITA-4680). */
  notAllowedCategories: FamiliesMapGoogleCategory[];
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
  const enabled = googleCategories.filter((c) => c.enabled);
  const allowed = new Set(enabled.map((c) => c.slug));
  return {
    families: families
      .filter((f) => f.slug !== "undefined")
      .map((f) => ({
        slug: f.slug,
        label: f.label,
        emoji: f.emoji,
        sortOrder: f.sort_order,
        meaning: FAMILY_MEANINGS[f.slug] ?? "",
      })),
    enabledCategories: enabled.map(row).sort(byLabel),
    notAllowedCategories: Object.keys(GOOGLE_TYPE_SUPER)
      .filter((slug) => !allowed.has(slug) && !GOOGLE_TABLE_B_TYPES.has(slug))
      .map((slug) => ({ slug, label: humanizeCategorySlug(slug) ?? slug }))
      .sort(byLabel),
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

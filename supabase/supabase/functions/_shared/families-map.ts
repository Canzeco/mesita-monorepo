// The Families page payload. Families and categories come from the live
// tables. Google types come from the code map — that record is the
// exclusive side of the taxonomy, and it is not stored twice.
import type { PlaceCategory, PlaceFamily } from "./categories.ts";
import { GOOGLE_TYPE_SUPER, type SuperOrOther } from "./google-type-super.ts";

export type FamiliesMapFamily = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type FamiliesMapCategory = {
  slug: string;
  label: string;
  familyKeys: string[];
};

export type FamiliesMapGoogleType = {
  slug: string;
  family: SuperOrOther;
};

export type FamiliesMap = {
  families: FamiliesMapFamily[];
  categories: FamiliesMapCategory[];
  googleTypes: FamiliesMapGoogleType[];
};

export function buildFamiliesMap(
  families: PlaceFamily[],
  categories: PlaceCategory[],
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
      familyKeys: c.family_keys ?? [],
    })),
    googleTypes: Object.entries(GOOGLE_TYPE_SUPER)
      .map(([slug, family]) => ({ slug, family }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

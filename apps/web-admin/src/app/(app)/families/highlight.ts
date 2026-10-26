// Bidirectional highlight for the Families page. The stored relations
// map a category to its list of families (MESITA-2808: no primary family).
// The other direction is derived here and never stored.

export type FamilyRow = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type CategoryRow = {
  slug: string;
  label: string;
  familyKeys: string[];
};

export type GoogleTypeRow = {
  slug: string;
  family: string;
};

export type TagRow = {
  slug: string;
  label: string;
  facet: string;
  facetLabel: string;
  facetEmoji: string;
  sortOrder: number;
};

export type GoogleMembershipRow = {
  slug: string;
  familyKeys: string[];
};

export type FamiliesMap = {
  families: FamilyRow[];
  categories: CategoryRow[];
  googleTypes: GoogleTypeRow[];
  googleMembership: GoogleMembershipRow[];
  tags: TagRow[];
};

export type FamiliesSelection =
  | { kind: "family"; slug: string }
  | { kind: "google"; slug: string }
  | { kind: "category"; slug: string };

export type FamiliesHighlight = {
  families: Set<string>;
  google: Set<string>;
  categories: Set<string>;
};

export function highlightFamilies(
  map: FamiliesMap,
  sel: FamiliesSelection,
): FamiliesHighlight {
  const families = new Set<string>();
  const google = new Set<string>();
  const categories = new Set<string>();

  const addFamily = (slug: string) => {
    families.add(slug);
    for (const row of map.googleTypes) {
      if (row.family === slug) google.add(row.slug);
    }
    for (const row of map.categories) {
      if (row.familyKeys.includes(slug)) categories.add(row.slug);
    }
  };

  if (sel.kind === "family") addFamily(sel.slug);
  if (sel.kind === "google") {
    const row = map.googleTypes.find((g) => g.slug === sel.slug);
    if (row) addFamily(row.family);
  }
  if (sel.kind === "category") {
    const row = map.categories.find((c) => c.slug === sel.slug);
    if (row) {
      categories.add(row.slug);
      for (const key of row.familyKeys) addFamily(key);
    }
  }
  return { families, google, categories };
}

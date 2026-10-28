// The Atlas page's payload types (MESITA-2891). The category ↔ family matrix
// and its bidirectional highlight are gone: a place's Mesita Families are the
// Description step's model pick, and every Google category is either enabled
// on Mesita or not.

export type FamilyRow = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type GoogleCategoryRow = {
  slug: string;
  label: string;
};

export type TagRow = {
  slug: string;
  label: string;
  facet: string;
  facetLabel: string;
  facetEmoji: string;
  sortOrder: number;
};

export type FamiliesMap = {
  families: FamilyRow[];
  enabledCategories: GoogleCategoryRow[];
  disabledCategories: GoogleCategoryRow[];
  tags: TagRow[];
};

// The Atlas page's payload types (MESITA-2891). The category ↔ family matrix
// and its bidirectional highlight are gone: a place's Mesita Families are the
// Description step's model pick, and every Google category is either enabled
// on Mesita or not.

export type FamilyRow = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
  /** What the family means to the Description prompt (MESITA-4238). */
  meaning?: string;
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

/** One field's limits (MESITA-4581): Create's, Enrich's and the hard ceiling. */
export type FieldLimitRow = { create: number; enrich: number; min: number; max: number };

export type FieldLimits = {
  families: FieldLimitRow;
  presentation: FieldLimitRow;
  tags: FieldLimitRow;
};

export type FamiliesMap = {
  families: FamilyRow[];
  enabledCategories: GoogleCategoryRow[];
  disabledCategories: GoogleCategoryRow[];
  tags: TagRow[];
};

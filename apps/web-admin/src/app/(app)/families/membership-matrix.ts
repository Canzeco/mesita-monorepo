export type MembershipFamily = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type MembershipRow = {
  slug: string;
  familyKeys: string[];
};

/** Guest columns. Undefined is the leftover, not a column. */
export function guestFamilyColumns(families: MembershipFamily[]): MembershipFamily[] {
  return families
    .filter((family) => family.slug !== "undefined")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

export function filterMembershipRows(rows: MembershipRow[], query: string): MembershipRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => googleTypeHaystack(row.slug).toLowerCase().includes(q));
}

export function cellOn(row: MembershipRow, familySlug: string): boolean {
  return row.familyKeys.includes(familySlug);
}

/** The column shows spaces. Search must hit that label and the stored slug. */
export function googleTypeHaystack(slug: string): string {
  return `${slug.replaceAll("_", " ")} ${slug}`;
}

export function googleCategoryLabel(slug: string): string {
  return slug.replaceAll("_", " ");
}

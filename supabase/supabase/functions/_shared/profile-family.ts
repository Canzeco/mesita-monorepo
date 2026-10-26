// Family and Category display for the Single Place profile read.
//
// Resolved here, on the way out of admin-web-get-overview (and restamped by
// admin-web-update-place after a save). The admin client paints the strings;
// it does not join slugs to emoji and labels.
//
// Precedence, the same as families_for_category():
//   · a category in the live dictionary → that category's families;
//   · a Google type with a catalog_membership row → that row's families
//     (MESITA-2759; the caller reads the row, `membershipKeys`);
//   · anything else → the Undefined family.
// Keys copied onto a place are not membership.

import type { PlaceCategory, PlaceFamily } from "./categories.ts";

export type ResolvedFamily = {
  /** "🍸 Bars & Nightlife" or "🍸 Bars & Nightlife · 🎟️ Experiences". */
  text: string;
  /** True only on the stored-family_keys branch. */
  inferred: boolean;
};

export type CategoryOption = PlaceCategory & {
  /** Membership already joined. Blank category and `undefined` do not use it. */
  family_display: string;
};

const UNDEFINED_FALLBACK = "❓ Undefined";

function chip(slug: string, families: readonly PlaceFamily[]): string | null {
  const row = families.find((f) => f.slug === slug);
  return row ? `${row.emoji} ${row.label}` : null;
}

function joinFamilies(
  slugs: readonly string[],
  families: readonly PlaceFamily[],
): string | null {
  const parts = slugs
    .filter((s) => s !== "undefined")
    .map((s) => chip(s, families))
    .filter((s): s is string => s != null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function undefinedFamily(families: readonly PlaceFamily[]): string {
  return chip("undefined", families) ?? UNDEFINED_FALLBACK;
}

export function asFamilyKeys(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const keys = value.filter((x): x is string => typeof x === "string");
  return keys.length > 0 ? keys : null;
}

/** The stored-keys branch: what Family shows while Category is undefined. */
export function resolveStoredFamily(
  familyKeys: unknown,
  families: readonly PlaceFamily[],
): ResolvedFamily {
  const text = joinFamilies(asFamilyKeys(familyKeys) ?? [], families);
  if (text) return { text, inferred: true };
  return { text: undefinedFamily(families), inferred: false };
}

/** Family display is the category's current mapping. Place rows do not store it. */
export function resolveProfileFamily(input: {
  category: unknown;
  familyKeys?: unknown;
  /** catalog_membership's row for a category the dictionary lacks. */
  membershipKeys?: unknown;
  categories: readonly PlaceCategory[];
  families: readonly PlaceFamily[];
}): ResolvedFamily {
  const slug = profileCategorySlug(input.category);
  if (slug) {
    const hit = input.categories.find((c) => c.slug === slug);
    if (hit) {
      const text = joinFamilies(hit.family_keys ?? [], input.families);
      return { text: text ?? undefinedFamily(input.families), inferred: false };
    }
    const membership = asFamilyKeys(input.membershipKeys);
    if (membership) {
      const text = joinFamilies(membership, input.families);
      return { text: text ?? undefinedFamily(input.families), inferred: false };
    }
  }
  return { text: undefinedFamily(input.families), inferred: false };
}

/** The category slug as the dictionary spells it, or "" for none. */
export function profileCategorySlug(category: unknown): string {
  return typeof category === "string" ? category.trim().toLowerCase() : "";
}

/** The slug whose catalog_membership row resolveProfileFamily needs: a
 *  category the dictionary lacks, or null when the dictionary answers. */
export function membershipSlugFor(
  category: unknown,
  categories: readonly PlaceCategory[],
): string | null {
  const slug = profileCategorySlug(category);
  if (!slug || categories.some((c) => c.slug === slug)) return null;
  return slug;
}

/** One display string per category, so a draft change is a lookup. */
export function categoriesWithFamilyDisplay(
  categories: readonly PlaceCategory[],
  families: readonly PlaceFamily[],
): CategoryOption[] {
  return categories.map((c) => ({
    ...c,
    family_display: joinFamilies(c.family_keys ?? [], families) ??
      undefinedFamily(families),
  }));
}

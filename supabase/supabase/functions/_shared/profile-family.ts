// Family and Category display for the Single Place profile read.
//
// Resolved here, on the way out of admin-web-get-overview (and restamped by
// admin-web-update-place after a save). The admin client paints the strings;
// it does not join slugs to emoji and labels.
//
// Precedence, same law the Profile field has always shown:
//   · a real category → that category's full membership (1–2 families);
//   · category undefined / unknown → the stored family_keys, marked inferred;
//   · nothing known → the Undefined family.

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

/** The row as stored. A defined category wins; otherwise the stored keys. */
export function resolveProfileFamily(input: {
  category: unknown;
  familyKeys: unknown;
  categories: readonly PlaceCategory[];
  families: readonly PlaceFamily[];
}): ResolvedFamily {
  const slug = typeof input.category === "string"
    ? input.category.trim().toLowerCase()
    : "";
  if (slug && slug !== "undefined") {
    const hit = input.categories.find((c) => c.slug === slug);
    const text = joinFamilies(hit?.family_keys ?? [], input.families);
    if (text) return { text, inferred: false };
  }
  return resolveStoredFamily(input.familyKeys, input.families);
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

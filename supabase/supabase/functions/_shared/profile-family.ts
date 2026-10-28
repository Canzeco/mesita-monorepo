// Families display for the Single Place profile read (MESITA-2790).
//
// Families are stored (1–5, model-inferred on Create and every Enrich,
// MESITA-2891; an operator may set them on Basics, MESITA-2893); this only
// names the family_keys on the way out of
// admin-web-get-overview (and admin-web-update-place after a save), so the
// admin client paints a string instead of joining slugs to emoji and labels.

import type { PlaceFamily } from "./categories.ts";

export type ResolvedFamily = {
  /** "🍸 Bars & Nightlife" or "🍸 Bars & Nightlife · 🎟️ Experiences". */
  text: string;
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

/** The stored family_keys as one display string; Undefined when none name a family. */
export function resolveStoredFamily(
  familyKeys: unknown,
  families: readonly PlaceFamily[],
): ResolvedFamily {
  const text = joinFamilies(asFamilyKeys(familyKeys) ?? [], families);
  return { text: text ?? undefinedFamily(families) };
}


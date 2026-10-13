import type { ProfileRead, ResolvedFamily } from "./actions";

// Picks which server-resolved Family string to paint. The join of slug →
// emoji + label already happened in admin-web-get-overview; this only
// chooses among those strings when the Category draft changes.

export function shownFamily(
  draftCategory: string,
  storedCategory: string | null | undefined,
  profile: Pick<ProfileRead, "family" | "familyStored" | "categories">,
): ResolvedFamily {
  const slug = draftCategory.trim().toLowerCase();
  const stored = (storedCategory ?? "").trim().toLowerCase();
  if (slug === stored) return profile.family;
  if (!slug || slug === "undefined") return profile.familyStored;
  const row = profile.categories.find((c) => c.slug === slug);
  if (row) return { text: row.family_display, inferred: false };
  return profile.familyStored;
}

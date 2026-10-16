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
  // The option's display is the live mapping. A place does not keep its own.
  const row = profile.categories.find((c) => c.slug === slug);
  if (row?.family_display) return { text: row.family_display, inferred: false };
  if (!slug || slug === "undefined") {
    const fallback = profile.categories.find((c) => c.slug === "undefined");
    if (fallback?.family_display) {
      return { text: fallback.family_display, inferred: false };
    }
  }
  if (slug === stored) return profile.family;
  return profile.family;
}

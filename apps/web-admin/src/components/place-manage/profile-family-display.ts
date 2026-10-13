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
  // Undefined has no membership display. The stored-keys string is the one
  // the read (and a later save) resolved.
  if (!slug || slug === "undefined") return profile.familyStored;
  // A catalog slug carries its own display. Prefer that over profile.family
  // so a save that moved the row onto this slug still paints the right
  // families when the restamp did not land.
  const row = profile.categories.find((c) => c.slug === slug);
  if (row) return { text: row.family_display, inferred: false };
  if (slug === stored) return profile.family;
  return profile.familyStored;
}

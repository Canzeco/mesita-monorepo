const ACRONYM_WORDS = new Set(["bbq"]);

/**
 * Split a category display string into leading emoji (if any) + text.
 * Catalog labels are stored as `"🍽️ Fine Dining"` on `place_categories.label`
 * / `places.category_label`. Slugs like `fine_dining` have no emoji prefix.
 *
 * The emoji is dropped for display: only Mesita families wear one
 * (Pato, MESITA-2771, reversing the old "emoji everywhere" rule).
 */
function splitCategoryLabel(input: string): { emoji: string; text: string } {
  const trimmed = input.trim();
  const textStart = trimmed.search(/[\p{L}\p{N}]/u);
  if (textStart <= 0) {
    return { emoji: "", text: trimmed };
  }
  return {
    emoji: trimmed.slice(0, textStart).trim(),
    text: trimmed.slice(textStart).trim(),
  };
}

function titleizeCategoryWords(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYM_WORDS.has(lower)) return lower.toUpperCase();
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

/** Format a category label or slug for display, without its emoji. */
function formatPlaceCategoryName(
  category: string | null | undefined,
): string | null {
  if (!category) return null;
  const trimmed = category.trim();
  if (!trimmed) return null;

  const { text } = splitCategoryLabel(trimmed);
  const normalized = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return titleizeCategoryWords(normalized);
}

/**
 * Prefer `category_label` (the catalog's name) over the slug.
 */
export function resolvePlaceCategoryName(input: {
  categoryLabel?: string | null;
  category?: string | null;
}): string | null {
  return (
    formatPlaceCategoryName(input.categoryLabel) ??
    formatPlaceCategoryName(input.category) ??
    null
  );
}

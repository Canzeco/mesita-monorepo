const ACRONYM_WORDS = new Set(["bbq"]);

function stripLeadingEmoji(input: string): string {
  return input.replace(/^[^\p{L}\p{N}]+/u, "").trim();
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

export function formatPlaceCategoryName(
  category: string | null | undefined,
): string | null {
  if (!category) return null;
  const trimmed = category.trim();
  if (!trimmed) return null;

  const withoutEmoji = stripLeadingEmoji(trimmed);
  if (!withoutEmoji) return null;

  const normalized = withoutEmoji.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return null;
  return titleizeCategoryWords(normalized);
}

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

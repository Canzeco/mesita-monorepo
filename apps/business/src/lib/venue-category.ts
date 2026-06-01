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

export function formatVenueCategoryName(
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

export function resolveVenueCategoryName(input: {
  categoryLabel?: string | null;
  category?: string | null;
}): string | null {
  return (
    formatVenueCategoryName(input.categoryLabel) ??
    formatVenueCategoryName(input.category) ??
    null
  );
}

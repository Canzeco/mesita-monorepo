const ACRONYM_WORDS = new Set(['bbq']);

function splitCategoryLabel(input: string): { emoji: string; text: string } {
  const trimmed = input.trim();
  const textStart = trimmed.search(/[\p{L}\p{N}]/u);
  if (textStart <= 0) {
    return { emoji: '', text: trimmed };
  }
  return {
    emoji: trimmed.slice(0, textStart).trim(),
    text: trimmed.slice(textStart).trim(),
  };
}

function titleizeCategoryWords(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYM_WORDS.has(lower)) return lower.toUpperCase();
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
    })
    .join(' ');
}

function formatPlaceCategoryName(
  category: string | null | undefined,
): string | null {
  if (!category) return null;
  const trimmed = category.trim();
  if (!trimmed) return null;

  const { emoji, text } = splitCategoryLabel(trimmed);
  const source = text || trimmed;
  const normalized = source.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return emoji || null;
  const titled = titleizeCategoryWords(normalized);
  return emoji ? `${emoji} ${titled}` : titled;
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

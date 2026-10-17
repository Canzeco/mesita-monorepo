export function photoCaption(analyses: unknown, url: string): string | null {
  if (!analyses || typeof analyses !== "object" || Array.isArray(analyses)) return null;
  const text = (analyses as Record<string, unknown>)[url];
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  return trimmed || null;
}

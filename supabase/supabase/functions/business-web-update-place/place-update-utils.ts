export function isMissingCategoryLabelColumnError(
  err: { message?: string } | null,
): boolean {
  if (!err?.message) return false;
  return (
    err.message.includes("category_label") &&
    (err.message.includes("schema cache") || err.message.includes("column"))
  );
}

export function optString(v: unknown, maxLen: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

// The family list is the live place_families rows. A category may sit in
// several of them. Undefined never shares a category with a real family.

export function normalizeCategoryFamilies(
  input: unknown,
  allowed: readonly string[],
): { ok: true; keys: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "familyKeys must be a list" };
  const known = new Set(allowed);
  const keys: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") return { ok: false, error: "familyKeys must be slugs" };
    const slug = item.trim();
    if (!slug || !known.has(slug)) return { ok: false, error: `Unknown family: ${slug || "(empty)"}` };
    if (!keys.includes(slug)) keys.push(slug);
  }
  if (keys.includes("undefined") && keys.length > 1) {
    return { ok: false, error: "Undefined does not share a category with another family" };
  }
  return { ok: true, keys };
}

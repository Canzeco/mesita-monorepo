/**
 * Consumer place-tag display contract (MESITA-963).
 *
 * - `label_en` is Mesita core / the default chip text.
 * - `label_es` stays in the catalog for a future TMS — do not prefer it here.
 * - Do not bind chips to `mesita:pref:language` until that TMS exists
 *   (the pref still defaults to `es`).
 * - `slug` is the stable translation key for later.
 */
export function displayPlaceTagLabel(tag: {
  slug: string;
  label_en?: string | null;
  label_es?: string | null;
}): string {
  const en = typeof tag.label_en === "string" ? tag.label_en.trim() : "";
  if (en) return en;
  return tag.slug.replace(/_/g, " ");
}

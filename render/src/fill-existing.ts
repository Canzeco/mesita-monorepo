// Overwrite is one switch for the whole run. Off keeps values that already
// exist and still lets sync metrics replace themselves. On keeps the patch.
// The Mesita categories and tags are not Render's (MESITA-2790): the write EF
// infers them from the saved row every run and writes them only on success,
// so Render never sends them, whatever the switch says.

const PROTECTED = [
  "google_name",
  "mesita_name",
  "name",
  "description",
  "address",
  "zone",
  "city",
  "lat",
  "lng",
  "photos",
  "phone",
  "website_url",
  "instagram_url",
  "facebook_url",
  "opentable_url",
  "uber_eats_url",
  "whatsapp_url",
  "google_maps_url",
  "google_address",
] as const;
/** Columns the write EF infers; Render's patch never carries them. */
const MESITA_OWNED = ["category", "category_label", "mesita_categories", "tags"] as const;

export function hasSavedValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function applyOverwrite(opts: {
  overwrite: boolean;
  patch: Record<string, unknown>;
  saved: Record<string, unknown>;
}): Record<string, unknown> {
  const next = { ...opts.patch };
  for (const key of MESITA_OWNED) delete next[key];
  if (opts.overwrite) return next;
  for (const key of PROTECTED) {
    const saved = key === "photos" ? enrichedGallery(opts.saved.photos) : hasSavedValue(opts.saved[key]);
    if (saved) next[key] = opts.saved[key];
  }
  return next;
}

/** One photo is Create's Google hero, not a gallery to keep (MESITA-2794). */
function enrichedGallery(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.filter((item) => typeof item === "string" && item.trim().length > 0).length > 1;
}


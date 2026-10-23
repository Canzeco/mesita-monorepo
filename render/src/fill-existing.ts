// Overwrite is one switch for the whole run. Off keeps values that already
// exist and still lets sync metrics replace themselves. On keeps the patch.

const PROTECTED = [
  "google_name",
  "mesita_name",
  "name",
  "category",
  "category_label",
  "description",
  "address",
  "zone",
  "city",
  "lat",
  "lng",
  "google_photos",
  "mesita_photos",
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
  if (opts.overwrite) {
    const tags = stringList(opts.patch.tags);
    return tags ? { ...opts.patch, tags } : opts.patch;
  }
  const next = { ...opts.patch };
  for (const key of PROTECTED) {
    if (hasSavedValue(opts.saved[key])) next[key] = opts.saved[key];
  }
  const kept = stringList(opts.saved.tags);
  const added = stringList(opts.patch.tags);
  if (kept.length > 0 || added.length > 0) {
    next.tags = [...new Set([...kept, ...added])];
  }
  return next;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

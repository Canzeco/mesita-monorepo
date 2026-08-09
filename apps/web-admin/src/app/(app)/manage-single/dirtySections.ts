/** Stable keys registered via UnitPlaceContext.setSectionDirty. */
export const DIRTY_SECTION_ORDER = [
  "place",
  "products",
  "reservations",
  "check-pin",
  "require-bill",
] as const;

export type DirtySectionKey = (typeof DIRTY_SECTION_ORDER)[number];

export const DIRTY_SECTION_LABELS: Record<DirtySectionKey, string> = {
  place: "Place",
  products: "Products",
  reservations: "Reservations",
  "check-pin": "Check PIN",
  "require-bill": "Require bill",
};

/** Human labels for currently-dirty sections, in UI order. */
export function dirtySectionLabels(
  dirtyMap: Record<string, boolean>,
): string[] {
  const labels: string[] = [];
  for (const key of DIRTY_SECTION_ORDER) {
    if (dirtyMap[key]) labels.push(DIRTY_SECTION_LABELS[key]);
  }
  // Unknown keys last, stable alpha — shouldn't happen in prod.
  for (const key of Object.keys(dirtyMap).sort()) {
    if ((DIRTY_SECTION_ORDER as readonly string[]).includes(key)) continue;
    if (dirtyMap[key]) labels.push(key);
  }
  return labels;
}

export function dirtyDialogTitle(labels: string[]): string {
  if (labels.length === 1) return `Unsaved ${labels[0]} edits`;
  return "Unsaved edits";
}

export function dirtyDialogNavBody(labels: string[]): string {
  if (labels.length === 0) {
    return "You have unsaved edits. Discard them to leave this page, or cancel and save first.";
  }
  if (labels.length === 1) {
    return `You have unsaved ${labels[0]} edits. Discard them to leave this page, or cancel and save first.`;
  }
  return `You have unsaved edits in ${labels.join(", ")}. Discard them to leave this page, or cancel and save first.`;
}

export function dirtyDialogReenrichBody(labels: string[]): string {
  const where =
    labels.length === 0
      ? "fields you're editing"
      : labels.length === 1
        ? `your unsaved ${labels[0]} edits`
        : `your unsaved edits (${labels.join(", ")})`;
  return `Re-enrich can overwrite ${where}. Discard unsaved changes and queue the Enricher, or cancel and save first.`;
}

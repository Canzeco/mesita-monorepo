// Place display-name helpers — dual identity (MESITA-917).
//
// `places.google_name` = Google Places displayName (Enricher spine).
// `places.name` = Mesita/display (admin/business editable).
// Display priority: trimmed Mesita name if set, else google_name.
// Sticky sync: when Mesita name is empty OR still equals the previous
// google_name (trim + NFKC), Re-enrich updates both; otherwise only
// google_name moves.

import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

export type PlaceNameRow = {
  name?: string | null;
  google_name?: string | null;
};

/** Normalize for equality / emptiness — trim + Unicode NFKC. */
export function normalizePlaceName(s: string | null | undefined): string {
  return (s ?? "").normalize("NFKC").trim();
}

/**
 * Resolve the label shown to every audience.
 * Empty Mesita name → google_name → "(unnamed)".
 */
export function displayName(row: PlaceNameRow): string {
  const mesita = normalizePlaceName(row.name);
  if (mesita) return mesita;
  const google = normalizePlaceName(row.google_name);
  if (google) return google;
  return "(unnamed)";
}

/**
 * Wire mapper: overwrite `name` with the resolved display label.
 * Keeps raw `google_name` so clients that need the spine still see it.
 * Use on every place-row response that leaves an EF (MESITA-925).
 */
export function withDisplayName<T extends PlaceNameRow>(row: T): T {
  return { ...row, name: displayName(row) };
}

/** Map a list of place rows through {@link withDisplayName}. */
export function withDisplayNames<T extends PlaceNameRow>(rows: T[]): T[] {
  return rows.map(withDisplayName);
}

/**
 * True when Mesita `name` should track Google on the next enrich write:
 * empty/null Mesita name, or still equal to the previous google_name.
 */
export function isStickyMesitaName(
  currentName: string | null | undefined,
  previousGoogleName: string | null | undefined,
): boolean {
  const n = normalizePlaceName(currentName);
  if (!n) return true;
  return n === normalizePlaceName(previousGoogleName);
}

export type StickyNamePatch = {
  google_name: string;
  /** Present only when sticky — Mesita name should follow Google. */
  name?: string;
  sticky: boolean;
};

/** Build the places update for a fresh Google displayName. */
export function stickyNamePatch(args: {
  newGoogleName: string;
  currentName: string | null | undefined;
  previousGoogleName: string | null | undefined;
}): StickyNamePatch {
  const max = ENRICH_FIELD_LIMITS.placeName.max;
  const google_name = normalizePlaceName(args.newGoogleName).slice(0, max);
  const sticky = isStickyMesitaName(args.currentName, args.previousGoogleName);
  if (sticky) {
    return { google_name, name: google_name, sticky: true };
  }
  return { google_name, sticky: false };
}

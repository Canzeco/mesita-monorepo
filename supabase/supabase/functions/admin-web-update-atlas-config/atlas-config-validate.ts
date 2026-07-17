/** Validators for admin-web-update-atlas-config (int ranges + image-funnel lock). */

export function intInRange(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

export const FUNNEL_COLS = [
  "atlas_gather_google_images",
  "atlas_gather_instagram_depth",
  "atlas_gather_instagram_posts",
  "atlas_analyze_google_images",
  "atlas_analyze_instagram_images",
  "atlas_save_total_images",
] as const;

export type FunnelCol = (typeof FUNNEL_COLS)[number];

/** Merge patch over the current row for one funnel column. */
export function effectiveFunnelValue(
  patch: Record<string, unknown>,
  cur: Record<string, unknown> | null,
  col: FunnelCol,
): number {
  const p = patch[col];
  if (typeof p === "number") return p;
  const v = cur?.[col];
  return typeof v === "number" ? v : 0;
}

/**
 * Image-funnel per-source lock: IG keep ≤ depth · analyze ≤ keep per source ·
 * save ≤ analyzed total. Returns an error string when a bound is violated.
 */
export function funnelLockError(
  googleKeep: number,
  igDepth: number,
  igKeep: number,
  googleAnalyze: number,
  igAnalyze: number,
  save: number,
): string | null {
  if (igKeep > igDepth) {
    return `Instagram keep (${igKeep}) can't exceed the download depth (${igDepth}).`;
  }
  if (googleAnalyze > googleKeep) {
    return `Google analyze (${googleAnalyze}) can't exceed Google images kept (${googleKeep}).`;
  }
  if (igAnalyze > igKeep) {
    return `Instagram analyze (${igAnalyze}) can't exceed Instagram images kept (${igKeep}).`;
  }
  if (save > googleAnalyze + igAnalyze) {
    return `Image selection (${save}) can't exceed the analysis total (${googleAnalyze + igAnalyze}).`;
  }
  return null;
}

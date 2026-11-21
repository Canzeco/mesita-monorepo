// Recent Google review growth inside Popularity (MESITA-4514).
//
// SQL owns the cohort (`discovery_growth_bases`): city + first known family,
// 8 positive-velocity peers, else the city, else no growth. This file is the
// blend the Edge Functions apply to the base SQL returns, and the weight
// schedule. `discovery_growth_weight` in the database is the same schedule;
// the tests pin both to the same numbers.

export const GROWTH_MIN_SPAN_DAYS = 7;
export const GROWTH_FULL_SPAN_DAYS = 30;
export const GROWTH_W_AT_MIN = 0.2;
export const GROWTH_CAP_DEFAULT = 0.5;
export const GROWTH_CAP_MAX = 0.8;

/** Why a place did or did not receive a growth base. */
export type GrowthKind = "missing" | "short" | "flat" | "grow" | "fallback";

export type GrowthTerm = {
  /** Days between the earliest and latest usable snapshots. Null when there
   *  is nothing to measure. */
  elapsedDays: number | null;
  /** Established-base units. Null when growth is not applied. 0 when the
   *  place was watched and did not gain reviews. */
  growthBase: number | null;
  kind: GrowthKind;
};

const KINDS = new Set<GrowthKind>(["missing", "short", "flat", "grow", "fallback"]);

/** Cap used by the schedule. Out of range values clamp. A missing cap is the launch 0.50. */
export function growthCap(raw: number | null | undefined): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : GROWTH_CAP_DEFAULT;
  return Math.min(GROWTH_CAP_MAX, Math.max(0, n));
}

/**
 * Growth's share of Popularity once two snapshots are at least 7 days apart.
 * `0.20 + 0.60 × min(observedDays / 30, 1)`: 7 days is 34% recent, 30 days
 * is 80% recent, and it stays at 80%. The stored cap is ignored. Only a
 * watched flat or growing place gets a share.
 */
export function growthWeight(
  elapsedDays: number | null,
  _cap: number | null | undefined,
  kind: GrowthKind,
): number {
  if (kind !== "flat" && kind !== "grow") return 0;
  if (elapsedDays === null || !Number.isFinite(elapsedDays) || elapsedDays < GROWTH_MIN_SPAN_DAYS) return 0;
  return 0.2 + 0.6 * Math.min(elapsedDays / GROWTH_FULL_SPAN_DAYS, 1);
}

/** googleReviewCount × googleStars. 0 when either is missing or the count is not positive. */
export function establishedBase(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
): number {
  if (typeof rating !== "number" || typeof reviewCount !== "number") return 0;
  if (!Number.isFinite(rating) || !Number.isFinite(reviewCount) || reviewCount <= 0) return 0;
  return Math.max(0, rating) * reviewCount;
}

/** (1 − w) × established + w × growthBase. No term, or a term that does not
 *  apply, leaves the established base unchanged. */
export function blendPopularity(
  established: number,
  term: GrowthTerm | undefined,
  cap: number | null | undefined,
): number {
  if (!(established > 0)) return 0;
  if (!term) return established;
  const w = growthWeight(term.elapsedDays, cap, term.kind);
  if (!(w > 0)) return established;
  const growth = term.kind === "flat" ? 0 : Math.max(0, term.growthBase ?? 0);
  return (1 - w) * established + w * growth;
}

export function growthTermsFromRows(rows: unknown): Map<string, GrowthTerm> {
  const map = new Map<string, GrowthTerm>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.place_id === "string" ? r.place_id : null;
    const kind = r.kind;
    if (!id || typeof kind !== "string" || !KINDS.has(kind as GrowthKind)) continue;
    const elapsed = r.elapsed_days;
    const base = r.growth_base;
    map.set(id, {
      elapsedDays: typeof elapsed === "number" && Number.isFinite(elapsed) ? elapsed : null,
      growthBase: typeof base === "number" && Number.isFinite(base) ? base : null,
      kind: kind as GrowthKind,
    });
  }
  return map;
}

type GrowthRpc = (
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** One cohort read. A missing function or a failed read is an empty map:
 *  every place then scores on its established base alone. */
export async function fetchGrowthTerms(
  rpc: GrowthRpc,
  requireActive: boolean,
  knownFamilies: readonly string[],
): Promise<Map<string, GrowthTerm>> {
  try {
    const { data, error } = await rpc({
      p_require_active: requireActive,
      p_known_families: [...knownFamilies],
    });
    if (error) {
      console.error("[discovery-growth]", error.message);
      return new Map();
    }
    return growthTermsFromRows(data);
  } catch (err) {
    console.error("[discovery-growth]", err instanceof Error ? err.message : "growth read failed");
    return new Map();
  }
}

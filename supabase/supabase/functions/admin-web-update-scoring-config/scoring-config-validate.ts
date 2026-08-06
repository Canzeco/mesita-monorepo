// Validate the Lineup Config blob (app_settings.scoring_config, v12) — the
// strict gate on save. Extracted from index.ts so it is importable by tests;
// mirrors the sibling-module pattern of rewards-config-normalize.ts and
// reservations-config-normalize.ts.
//
// STRICT BY DESIGN, and that has teeth: the admin page posts the WHOLE blob on
// every section save (ScoringProvider.blobFor spreads the last-saved blob), so
// a single key the client stops sending 400s EVERY section, not just its own.
// That is exactly what MESITA-804 hit — `rp.dominant` went missing client-side
// in #497 and `/lineup-config` could not save anything for a week.
//
// The required-key contract is pinned by the lineup-config-validate tests, which
// holds the canonical blob and deletes each required key in turn to prove it is
// load-bearing. If you add a required key here, the client's coercer
// (web-admin lib/business/scores.ts `coerceScoringSettings`) MUST emit it in
// the same change — the two are separate literals in separate runtimes, and
// nothing but that test connects them.

const STRATEGY_IDS = ["zero", "conservative", "aggressive", "dominant"] as const;
const LANE_N_MAX = 50;

function num(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

/** Structural validation + clamping. Returns the clean blob or an error string. */
export function validate(raw: unknown): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "config must be an object" };
  const r = raw as Record<string, unknown>;

  const LANE_IDS = ["organic", "inorganic"] as const;
  const laneN: Record<string, number> = {};
  if (typeof r.laneN === "number") {
    const n = num(r.laneN, 0, LANE_N_MAX);
    if (n == null) {
      return { ok: false, error: `laneN must be a number 0–${LANE_N_MAX}` };
    }
    for (const id of LANE_IDS) laneN[id] = Math.round(n);
  } else if (r.laneN && typeof r.laneN === "object") {
    const rawLaneN = r.laneN as Record<string, unknown>;
    for (const id of LANE_IDS) {
      const n = num(rawLaneN[id], 0, LANE_N_MAX);
      if (n == null) {
        return { ok: false, error: `laneN.${id} must be a number 0–${LANE_N_MAX}` };
      }
      laneN[id] = Math.round(n);
    }
  } else {
    return {
      ok: false,
      error: "laneN must be per-lane counts { organic, inorganic }",
    };
  }
  if (laneN.organic + laneN.inorganic < 1) {
    return { ok: false, error: "laneN: at least one lane must be > 0" };
  }

  // SM — one hyperparam per intent axis (v11). Soft-migrate v10 keys.
  const smIn = r.sm as Record<string, unknown> | undefined;
  const whereIn = smIn?.where as Record<string, unknown> | undefined;
  const defaultTolKm = num(whereIn?.defaultTolKm, 0.5, 20) ?? 5;

  const whenIn = smIn?.when as Record<string, unknown> | undefined;
  const patience =
    num(whenIn?.patience, 0, 1) ??
    num(whenIn?.waitFloor, 0, 1) ??
    0.35;

  const whatIn = smIn?.what as Record<string, unknown> | undefined;
  const tol =
    num(whatIn?.tol, 0, 1) ??
    num(whatIn?.sibling, 0, 1) ??
    0.5;

  // GP — ln ceiling + rating exponent (v11).
  const gpIn = r.gp as Record<string, unknown> | undefined;
  const lnCeiling = num(gpIn?.lnCeiling, 5, 15);
  if (lnCeiling == null) return { ok: false, error: "gp.lnCeiling out of range" };
  const ratingPow = num(gpIn?.ratingPow, 1, 2) ?? 1;

  // RP — the strategy rungs, [0,1].
  const rpIn = r.rp as Record<string, unknown> | undefined;
  const rp: Record<string, number> = {};
  for (const p of STRATEGY_IDS) {
    const v = num(rpIn?.[p], 0, 1);
    if (v == null) return { ok: false, error: `rp.${p} must be a number 0–1` };
    rp[p] = v;
  }

  // XX — the deck-wide randomness control (green default only).
  const xxIn = r.xx as Record<string, unknown> | undefined;
  const control = num(xxIn?.control, 0, 5);
  if (control == null) return { ok: false, error: "xx.control must be a number 0–5" };

  return {
    ok: true,
    config: {
      v: 12,
      laneN: {
        organic: laneN.organic,
        inorganic: laneN.inorganic,
      },
      sm: {
        where: { defaultTolKm },
        when: { patience },
        what: { tol },
      },
      gp: { lnCeiling, ratingPow },
      rp,
      xx: { control },
    },
  };
}

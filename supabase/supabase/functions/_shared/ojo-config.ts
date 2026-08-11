// Ojo config — the proof-verification engine's policy (MESITA-1035).
//
// Ojo (Spanish "eye"; "¡Ojo!" = watch out) reads the screenshot a guest posts
// as proof of an Instagram story or a Google review and returns a verdict.
// This module is the single normalizer for its policy blob, shared by the
// admin get/update EFs and (when it ships, MESITA-1034) by ojo-* itself — so
// the console and the engine can never disagree about defaults.
//
// Every knob is STAGED until the engine ships: the blob is live and editable,
// nothing reads it yet, and the console says so. House rule is that an
// unenforced config is a bug — a staged one has to be labeled.

export type OjoChecks = {
  placeNameMatches: boolean;
  isRightSurface: boolean;
  ratingPresent: boolean;
  recentTimestamp: boolean;
};

export type OjoConfig = {
  enabled: boolean;
  autoPassScore: number;
  reviewFloorScore: number;
  failAction: "flag" | "withhold";
  showGuestReason: boolean;
  maxRetries: number;
  checks: OjoChecks;
  prompt: string;
};

export const OJO_DEFAULTS: OjoConfig = {
  // OFF by default: until someone deliberately turns Ojo on, proofs keep the
  // MESITA-849 self-attest behavior and no vision call is made.
  enabled: false,
  autoPassScore: 0.75,
  reviewFloorScore: 0.45,
  failAction: "flag",
  showGuestReason: true,
  maxRetries: 3,
  checks: {
    placeNameMatches: true,
    isRightSurface: true,
    ratingPresent: true,
    recentTimestamp: false,
  },
  prompt: "",
};

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/** Tolerant read: any missing/!invalid key falls back to its default. */
export function normalizeOjoConfig(raw: unknown): OjoConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const checks = (r.checks ?? {}) as Record<string, unknown>;
  const autoPass = num(r.autoPassScore, OJO_DEFAULTS.autoPassScore, 0, 1);
  // The review floor can never sit above the auto-pass score, or the "flag for
  // review" band would be inverted and every proof would land in one bucket.
  const floor = Math.min(
    autoPass,
    num(r.reviewFloorScore, OJO_DEFAULTS.reviewFloorScore, 0, 1),
  );
  return {
    enabled: bool(r.enabled, OJO_DEFAULTS.enabled),
    autoPassScore: autoPass,
    reviewFloorScore: floor,
    failAction: r.failAction === "withhold" ? "withhold" : "flag",
    showGuestReason: bool(r.showGuestReason, OJO_DEFAULTS.showGuestReason),
    maxRetries: Math.round(num(r.maxRetries, OJO_DEFAULTS.maxRetries, 0, 10)),
    checks: {
      placeNameMatches: bool(
        checks.placeNameMatches,
        OJO_DEFAULTS.checks.placeNameMatches,
      ),
      isRightSurface: bool(
        checks.isRightSurface,
        OJO_DEFAULTS.checks.isRightSurface,
      ),
      ratingPresent: bool(
        checks.ratingPresent,
        OJO_DEFAULTS.checks.ratingPresent,
      ),
      recentTimestamp: bool(
        checks.recentTimestamp,
        OJO_DEFAULTS.checks.recentTimestamp,
      ),
    },
    prompt:
      typeof r.prompt === "string" ? r.prompt.slice(0, 4000) : OJO_DEFAULTS.prompt,
  };
}

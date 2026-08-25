// Intaker per-run spend ledger. Records estimated USD as each paid step
// completes so a run can persist gathered.cost. It does NOT abort a run.
// A dollar cap was MESITA-624; Pato retired it — collect / analyze knobs and
// the five-places-per-tick cron are the spend bounds.

import { COST, type EnrichConfig } from "./enrich-config.ts";

export type EnrichCostCharge = { key: string; usd: number };

export type EnrichCostSnapshot = {
  spentUsd: number;
  charges: EnrichCostCharge[];
};

/** Kept so existing fail-path type checks compile. Nothing throws this now. */
export class EnrichCostCapError extends Error {
  readonly spentUsd: number;
  readonly capUsd: number;
  readonly lastCharge: string;
  readonly charges: EnrichCostCharge[];
  readonly kind: "exceeded" | "blocked";

  constructor(
    ledger: EnrichCostLedger,
    lastCharge: string,
    kind: "exceeded" | "blocked" = "exceeded",
  ) {
    const spent = ledger.spentUsd;
    super(`enricher_cost_cap: retired — last ${lastCharge} spent $${spent.toFixed(3)}`);
    this.name = "EnrichCostCapError";
    this.spentUsd = spent;
    this.capUsd = Number.POSITIVE_INFINITY;
    this.lastCharge = lastCharge;
    this.charges = [...ledger.charges];
    this.kind = kind;
  }
}

export class EnrichCostLedger {
  spentUsd: number;
  charges: EnrichCostCharge[];
  readonly capUsd = Number.POSITIVE_INFINITY;

  constructor(prior?: EnrichCostSnapshot | null) {
    this.spentUsd = prior && Number.isFinite(prior.spentUsd) ? Math.max(0, prior.spentUsd) : 0;
    this.charges = prior?.charges ? [...prior.charges] : [];
  }

  remaining(): number {
    return Number.POSITIVE_INFINITY;
  }

  /** No-op: a dollar cap does not gate paid calls. */
  assertCanAfford(_usd: number, _key: string): void {
    return;
  }

  /** Record a completed paid call. Never throws. */
  charge(key: string, usd: number): void {
    if (!(usd > 0)) return;
    this.spentUsd = Math.round((this.spentUsd + usd) * 10_000) / 10_000;
    this.charges.push({ key, usd });
  }

  snapshot(): EnrichCostSnapshot {
    return { spentUsd: this.spentUsd, charges: [...this.charges] };
  }
}

export function createEnrichCostLedger(
  _capUsd?: number,
  prior?: EnrichCostSnapshot | null,
): EnrichCostLedger {
  return new EnrichCostLedger(prior);
}

export function costFromGathered(
  gathered: { cost?: EnrichCostSnapshot | null } | null | undefined,
): EnrichCostSnapshot | null {
  const c = gathered?.cost;
  if (!c || typeof c.spentUsd !== "number" || !Number.isFinite(c.spentUsd)) return null;
  return {
    spentUsd: c.spentUsd,
    charges: Array.isArray(c.charges) ? c.charges : [],
  };
}

/** S1 Google spine: Place Details + Time Zone + Place Photo media fetches. */
export function googleSpineCost(photoCount: number): number {
  return COST.googleDetails + COST.googleTimezone +
    COST.googlePhoto * Math.max(0, photoCount);
}

export function chargeGoogleSpine(
  ledger: EnrichCostLedger,
  photoCount: number,
): void {
  ledger.charge("google_details", COST.googleDetails);
  ledger.charge("google_timezone", COST.googleTimezone);
  const photos = Math.max(0, photoCount);
  if (photos > 0) ledger.charge("google_photos", COST.googlePhoto * photos);
}

export function instagramRunCost(depth: number): number {
  return COST.instagramProfile + COST.instagramPost * Math.max(0, depth) + COST.instagramVerify;
}

export function visionPerImageCost(visionQuality: string): number {
  return visionQuality === "economy" ? COST.visionPerImage : COST.visionPerImageStandard;
}

export function visionRunCost(imageCount: number, visionQuality: string): number {
  return visionPerImageCost(visionQuality) * Math.max(0, imageCount);
}

export function synthesisRunCost(quality: string): number {
  return quality === "economy" ? COST.synthesisEconomy : COST.synthesisStandard;
}

/** Firecrawl Search lines for channels with candidate count > 0 (admin cost model). */
export function discoverySearchCost(cfg: Pick<EnrichConfig, "discoverCandidates">): number {
  const n = Object.values(cfg.discoverCandidates).filter((c) => c > 0).length;
  return COST.firecrawlSearch * n;
}

export function isEnrichCostCapError(err: unknown): err is EnrichCostCapError {
  return err instanceof EnrichCostCapError ||
    (typeof err === "object" && err !== null &&
      (err as { name?: string }).name === "EnrichCostCapError");
}

// Enricher per-run spend ledger + cost-cap enforcement (MESITA-624).
//
// Uses the shared COST rate card in enrich-config.ts (mirrors the admin
// calculator). Accumulates estimated USD as each paid step completes; aborts
// the run when a charge would push spent over app_settings.atlas_per_run_cost_cap_usd.
// Approximate — enough to bound spend, not for billing.

import { COST, type EnrichConfig } from "./enrich-config.ts";

export type EnrichCostCharge = { key: string; usd: number };

export type EnrichCostSnapshot = {
  spentUsd: number;
  charges: EnrichCostCharge[];
};

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
    const cap = ledger.capUsd;
    const msg = kind === "blocked"
      ? `enricher_cost_cap: cannot afford ${lastCharge} — spent $${spent.toFixed(3)} / cap $${cap.toFixed(2)}`
      : `enricher_cost_cap: spent $${spent.toFixed(3)} exceeds cap $${cap.toFixed(2)} after ${lastCharge}`;
    super(msg);
    this.name = "EnrichCostCapError";
    this.spentUsd = spent;
    this.capUsd = cap;
    this.lastCharge = lastCharge;
    this.charges = [...ledger.charges];
    this.kind = kind;
  }
}

const EPS = 1e-9;

export class EnrichCostLedger {
  spentUsd: number;
  charges: EnrichCostCharge[];
  readonly capUsd: number;

  constructor(capUsd: number, prior?: EnrichCostSnapshot | null) {
    this.capUsd = Number.isFinite(capUsd) ? Math.max(0, capUsd) : 0;
    this.spentUsd = prior && Number.isFinite(prior.spentUsd) ? Math.max(0, prior.spentUsd) : 0;
    this.charges = prior?.charges ? [...prior.charges] : [];
  }

  remaining(): number {
    return Math.max(0, this.capUsd - this.spentUsd);
  }

  /** Throw without recording spend when the next paid call would breach the cap. */
  assertCanAfford(usd: number, key: string): void {
    if (!(usd > 0)) return;
    if (this.spentUsd + usd > this.capUsd + EPS) {
      throw new EnrichCostCapError(this, key, "blocked");
    }
  }

  /** Record a completed paid call; throw if accumulated spend is now over cap. */
  charge(key: string, usd: number): void {
    if (!(usd > 0)) return;
    this.spentUsd = Math.round((this.spentUsd + usd) * 10_000) / 10_000;
    this.charges.push({ key, usd });
    if (this.spentUsd > this.capUsd + EPS) {
      throw new EnrichCostCapError(this, key, "exceeded");
    }
  }

  snapshot(): EnrichCostSnapshot {
    return { spentUsd: this.spentUsd, charges: [...this.charges] };
  }
}

export function createEnrichCostLedger(
  capUsd: number,
  prior?: EnrichCostSnapshot | null,
): EnrichCostLedger {
  return new EnrichCostLedger(capUsd, prior);
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

// Promos Playground — the reward-distribution model (MESITA-991, v11 in
// MESITA-1069).
//
// Given the v11 config plus operator assumptions (visit mix, class mix, plan
// mix, per-visit action rates), compute the EXACT expected distribution of
// the total reward across N VISITS — every (class × plan × welcome × mesita ×
// story × google) combination is enumerated and weighted, no random sampling,
// so the chart never jitters under the cursor.
//
// Visits only: Orders is parked and prices nothing, so folding a remote band
// into this distribution would invent traffic that does not exist.
//
// Class and plan are INDEPENDENT axes (Notion §2.7 — "they never merge"), so
// the mix is two separate assumptions, not an eight-way split: a class
// distribution and one "what share pays for Premium" number.
//
// Pure module on purpose: vitest imports it directly, and the client
// component only renders what this returns.

import {
  CLASS_KEYS,
  PLAN_KEYS,
  visitsBaseFor,
  type ClassKey,
  type PlanKey,
  type PromosConfig,
  type StrategyKey,
} from "./promos";

export type Assumptions = {
  /** % of visits that are the guest's first verified ticket at the place. */
  welcomePct: number;
  /** Class mix in % — normalized proportionally if it doesn't sum to 100. */
  classPct: Record<ClassKey, number>;
  /** % of guests on the Premium plan — independent of class. */
  premiumPct: number;
  /** Per-visit probability (%) a guest performs each action. */
  actionPct: { mesita: number; story: number; google: number };
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  welcomePct: 20,
  classPct: { bronze: 70, silver: 15, gold: 10, diamond: 5 },
  premiumPct: 15,
  actionPct: { mesita: 30, story: 15, google: 10 },
};

export const SIMULATED_VISITS = 1000;

export type DistributionPoint = {
  value: number;
  visits: number;
  /**
   * Composition of those visits by how many bonuses they stack on the base —
   * [base only, exactly 1 bonus, 2 or more]. Welcome (the automatic bonus)
   * and each action bonus count alike; the three segments sum to `visits`.
   */
  byBonusCount: [number, number, number];
};

export type StrategyDistribution = {
  /** Reward % → expected visits, ascending by value, visits sum to N. */
  dist: DistributionPoint[];
  /** Expected discount rate — what the promo costs per bill on average. */
  mean: number;
  q1: number;
  median: number;
  q3: number;
  min: number;
  max: number;
  /**
   * The typical band — what all but the tails actually pay. The strategy
   * cards headline `mean` and quote p10–p90 (MESITA-1001): `min`/`max` are
   * the wrong statistic for a card because the extremes are ~0.01% of visits.
   */
  p10: number;
  p90: number;
};

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** Total reward for one concrete visit, capped at 100%. */
function visitTotal(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  plan: PlanKey,
  welcome: boolean,
  mesita: boolean,
  story: boolean,
  google: boolean,
): number {
  const b = cfg.visits.bonuses[strategy];
  const total =
    visitsBaseFor(cfg, strategy, cls, plan) +
    (welcome ? b.welcome : 0) +
    (mesita ? b.mesita : 0) +
    (story ? b.story : 0) +
    (google ? b.google : 0);
  return Math.min(100, total);
}

export function distributionFor(
  cfg: PromosConfig,
  assumptions: Assumptions,
  strategy: StrategyKey,
  visits: number = SIMULATED_VISITS,
): StrategyDistribution {
  const classSum =
    CLASS_KEYS.reduce((t, c) => t + clampPct(assumptions.classPct[c]), 0) || 1;
  const pw = clampPct(assumptions.welcomePct) / 100;
  const pm = clampPct(assumptions.actionPct.mesita) / 100;
  const ps = clampPct(assumptions.actionPct.story) / 100;
  const pg = clampPct(assumptions.actionPct.google) / 100;
  const pPremium = clampPct(assumptions.premiumPct) / 100;
  const planWeight: Record<PlanKey, number> = {
    free: 1 - pPremium,
    premium: pPremium,
  };

  // Per total value: overall probability + its split by bonus count
  // (0 = base only, 1, 2+) — Welcome and action bonuses count alike.
  const probByValue = new Map<number, [number, number, number]>();
  for (const cls of CLASS_KEYS) {
    const pc = clampPct(assumptions.classPct[cls]) / classSum;
    if (pc === 0) continue;
    for (const plan of PLAN_KEYS) {
      const pp = pc * planWeight[plan];
      if (pp === 0) continue;
      for (const w of [false, true]) {
        for (const m of [false, true]) {
          for (const s of [false, true]) {
            for (const g of [false, true]) {
              const p =
                pp *
                (w ? pw : 1 - pw) *
                (m ? pm : 1 - pm) *
                (s ? ps : 1 - ps) *
                (g ? pg : 1 - pg);
              if (p === 0) continue;
              const value = visitTotal(cfg, strategy, cls, plan, w, m, s, g);
              const bonusCount = Math.min(
                2,
                Number(w) + Number(m) + Number(s) + Number(g),
              );
              const split = probByValue.get(value) ?? [0, 0, 0];
              split[bonusCount] += p;
              probByValue.set(value, split);
            }
          }
        }
      }
    }
  }

  const values = [...probByValue.keys()].sort((a, b) => a - b);
  const dist: DistributionPoint[] = values.map((value) => {
    const split = probByValue.get(value) ?? [0, 0, 0];
    return {
      value,
      visits: (split[0] + split[1] + split[2]) * visits,
      byBonusCount: [
        split[0] * visits,
        split[1] * visits,
        split[2] * visits,
      ],
    };
  });

  let mean = 0;
  for (const d of dist) mean += d.value * d.visits;
  mean /= visits || 1;

  const percentile = (p: number): number => {
    let cum = 0;
    for (const d of dist) {
      cum += d.visits;
      if (cum >= p * visits) return d.value;
    }
    return dist.length > 0 ? dist[dist.length - 1].value : 0;
  };

  return {
    dist,
    mean,
    q1: percentile(0.25),
    median: percentile(0.5),
    q3: percentile(0.75),
    min: values[0] ?? 0,
    max: values[values.length - 1] ?? 0,
    p10: percentile(0.1),
    p90: percentile(0.9),
  };
}

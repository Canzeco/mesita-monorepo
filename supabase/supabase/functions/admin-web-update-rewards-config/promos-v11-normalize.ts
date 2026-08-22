// Normalize the Promos Config v11 payload (MESITA-1069) — the strict-shape,
// lenient-values gate on save. Mirrors coercePromosConfig + legacyRulesFrom in
// web-admin app/(app)/rewards-config/promos.ts — keep them in lock-step.
//
// v11 splits the two axes v10 conflated (Notion Main §2.7–2.8, Classes v2):
//
//   CONTEXT cuts first — visits (local) or orders (remote).
//   CLASS is who you are: bronze < silver < gold < diamond. Never purchasable.
//   PLAN is what you pay: free | premium. Private, server-side only.
//
// visits prices class × plan; orders drops class (presence can't be priced on
// a delivery order) and prices plan alone. ORDERS IS PARKED — the shape is
// stored and the operator can tune it, but no ticket carries a remote context
// yet, so the engine never reads those rates.
//
// Lenient by design (the MESITA-804 lesson): unknown keys drop, gaps fall
// back to defaults, every rate snaps to the 5% grid. The only hard error is a
// non-object body. A stored v10 blob MIGRATES rather than resetting.

const STRATEGY_KEYS = ["conservative", "aggressive", "dominant"] as const;
type StrategyKey = (typeof STRATEGY_KEYS)[number];

const CLASS_KEYS = ["bronze", "silver", "gold", "diamond"] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

const PLAN_KEYS = ["free", "premium"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

const ACTION_KEYS = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
] as const;
type ActionKey = (typeof ACTION_KEYS)[number];

// The legacy class rows the derived best-of grid still speaks. Each maps onto
// one (class, plan) cell of the VISITS grid — the legacy table has no context
// axis, and every ticket it ever priced was a visit.
const LEGACY_CLASS_KEYS = ["standard", "influencer", "premium", "aura"] as const;
type LegacyClassKey = (typeof LEGACY_CLASS_KEYS)[number];

export const LEGACY_CLASS_IDENTITY: Record<
  LegacyClassKey,
  { cls: ClassKey; plan: PlanKey }
> = {
  standard: { cls: "bronze", plan: "free" },
  influencer: { cls: "silver", plan: "free" },
  premium: { cls: "bronze", plan: "premium" },
  aura: { cls: "diamond", plan: "free" },
};

/**
 * Resolve a stored `consumers.class_key` onto the two v11 identity axes.
 *
 * THE BRIDGE, and deliberately temporary: `consumers` has no plan column yet,
 * so today the paid subscription is still encoded as the `premium` CLASS row.
 * Reading the plan back out of it is what lets v11 price real bills before the
 * schema catches up. When `consumers.plan` lands this function deletes itself.
 *
 * An unknown or missing key prices as bronze·free — the floor — rather than
 * erroring or leaking that it was unrecognised.
 */
export function identityForClassKey(
  key: string | null | undefined,
): { cls: ClassKey; plan: PlanKey } {
  const hit = (LEGACY_CLASS_KEYS as readonly string[]).includes(key ?? "")
    ? LEGACY_CLASS_IDENTITY[key as LegacyClassKey]
    : undefined;
  return hit ?? LEGACY_CLASS_IDENTITY.standard;
}

/**
 * What a SAVE body's `config` claims to be.
 *
 * Read and write are deliberately asymmetric. `normalizePromosV11` still
 * migrates a v10 blob on READ, because a restored or reset `app_config` row
 * can legitimately hold one and a ticket must never fail to price. A v10
 * WRITE is a different animal: no shipped client has produced one since the
 * v11 migration landed, so it can only come from a stale browser tab whose
 * bundle predates it. That tab renders its own bundled DEFAULTS (it cannot
 * parse a v11 blob), so accepting its save would silently overwrite the live
 * rates with launch defaults — losing every operator tuning at once.
 */
export type PromosWriteShape = "v11" | "stale-v10" | "other";

export function promosWriteShape(rawConfig: unknown): PromosWriteShape {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return "other";
  }
  const version = (rawConfig as Record<string, unknown>).version;
  if (version === 11) return "v11";
  if (version === 10) return "stale-v10";
  return "other";
}

export type ContextBonuses = {
  welcome: number;
  mesita: number;
  story: number;
  google: number;
};

/**
 * Bonuses are per STRATEGY as well as per context — Aggressive out-pays
 * Conservative on the actions exactly as it does on standing. A blob written
 * before this dimension existed is FLAT and migrates by copying its one set to
 * every strategy, so no bill moves and no version bump is needed.
 */
export type StrategyBonuses = Record<StrategyKey, ContextBonuses>;

export type PromosConfigV11 = {
  version: 11;
  visits: {
    base: Record<StrategyKey, Record<ClassKey, Record<PlanKey, number>>>;
    bonuses: StrategyBonuses;
  };
  orders: {
    base: Record<StrategyKey, Record<PlanKey, number>>;
    bonuses: StrategyBonuses;
    soon: boolean;
  };
  cap: number;
};

export type LegacyRuleRow = {
  strategy: StrategyKey;
  class: LegacyClassKey;
  action: ActionKey;
  discount_percent: number;
};

const RATE_STEP = 5;
const RATE_FLOOR = 5;
const RATE_MAX = 70;

const ALLOWED_CAPS = [200, 500, 1000] as const;
const CAP_DEFAULT = 500;

// The v11 defaults. Byte-identical to DEFAULT_PROMOS in the web-admin catalog.
export const DEFAULT_PROMOS_V11: PromosConfigV11 = {
  version: 11,
  visits: {
    base: {
      conservative: {
        bronze: { free: 10, premium: 20 },
        silver: { free: 15, premium: 25 },
        gold: { free: 20, premium: 30 },
        diamond: { free: 25, premium: 35 },
      },
      aggressive: {
        bronze: { free: 20, premium: 40 },
        silver: { free: 30, premium: 50 },
        gold: { free: 40, premium: 60 },
        diamond: { free: 50, premium: 70 },
      },
      // Additive by construction: floor 40, class steps 0/5/10/15, one plan
      // step of 15. Must stay byte-identical to the admin twin in
      // rewards-config/promos.ts — they are checked against each other.
      dominant: {
        bronze: { free: 40, premium: 55 },
        silver: { free: 45, premium: 60 },
        gold: { free: 50, premium: 65 },
        diamond: { free: 55, premium: 70 },
      },
    },
    bonuses: {
      conservative: { welcome: 10, mesita: 5, story: 10, google: 15 },
      aggressive: { welcome: 10, mesita: 5, story: 10, google: 15 },
      dominant: { welcome: 10, mesita: 10, story: 10, google: 15 },
    },
  },
  orders: {
    base: {
      conservative: { free: 5, premium: 10 },
      aggressive: { free: 10, premium: 15 },
      dominant: { free: 15, premium: 20 },
    },
    bonuses: {
      conservative: { welcome: 5, mesita: 5, story: 5, google: 10 },
      aggressive: { welcome: 5, mesita: 5, story: 5, google: 10 },
      dominant: { welcome: 10, mesita: 10, story: 10, google: 15 },
    },
    soon: true,
  },
  cap: CAP_DEFAULT,
};

function snapRate(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

function snapCap(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return CAP_DEFAULT;
  let best: number = ALLOWED_CAPS[0];
  for (const option of ALLOWED_CAPS) {
    if (Math.abs(option - v) < Math.abs(best - v)) best = option;
  }
  return best;
}

const isStrategy = (v: unknown): v is StrategyKey =>
  (STRATEGY_KEYS as readonly unknown[]).includes(v);
const isClass = (v: unknown): v is ClassKey =>
  (CLASS_KEYS as readonly unknown[]).includes(v);
const isPlan = (v: unknown): v is PlanKey =>
  (PLAN_KEYS as readonly unknown[]).includes(v);

function coerceOneBonusSet(raw: unknown, d: ContextBonuses): ContextBonuses {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    welcome: snapRate(b.welcome, d.welcome),
    mesita: snapRate(b.mesita, d.mesita),
    story: snapRate(b.story, d.story),
    google: snapRate(b.google, d.google),
  };
}

/** Accepts BOTH the flat legacy shape and the per-strategy one. */
function coerceBonuses(raw: unknown, d: StrategyBonuses): StrategyBonuses {
  const b = (raw ?? {}) as Record<string, unknown>;
  const isFlat = STRATEGY_KEYS.every((s) => b[s] === undefined);
  const out = {} as StrategyBonuses;
  for (const s of STRATEGY_KEYS) {
    out[s] = coerceOneBonusSet(isFlat ? b : b[s], d[s]);
  }
  return out;
}

/** Snap to the 5% grid without snapRate's floor/ceiling clamp. */
function midpoint(a: number, b: number): number {
  return Math.round((a + b) / 2 / RATE_STEP) * RATE_STEP;
}

/**
 * Migrate a v10 blob. The old four-class row set carried BOTH axes at once:
 *
 *   standard → bronze·free    influencer → silver·free
 *   premium  → bronze·premium aura       → diamond·free
 *
 * so the Premium PLAN uplift is exactly what the old `premium` class row paid
 * over `standard`, carried across every class. Gold — no v10 ancestor —
 * interpolates. The Influencer story override is DROPPED: it keyed on a class
 * that no longer exists, and v2 prices no per-class bonus.
 */
function migrateV10(r: Record<string, unknown>): PromosConfigV11 {
  const d = DEFAULT_PROMOS_V11;
  const rawBase = (r.base ?? {}) as Record<string, unknown>;
  const legacyAt = (s: StrategyKey, c: LegacyClassKey): number | undefined => {
    const row = rawBase[s];
    if (!row || typeof row !== "object") return undefined;
    const v = (row as Record<string, unknown>)[c];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };

  const visitsBase = structuredClone(d.visits.base);
  for (const s of STRATEGY_KEYS) {
    const bronzeFree = snapRate(
      legacyAt(s, "standard"),
      d.visits.base[s].bronze.free,
    );
    const bronzePremium = snapRate(
      legacyAt(s, "premium"),
      d.visits.base[s].bronze.premium,
    );
    const silverFree = snapRate(
      legacyAt(s, "influencer"),
      d.visits.base[s].silver.free,
    );
    const diamondFree = snapRate(
      legacyAt(s, "aura"),
      d.visits.base[s].diamond.free,
    );
    const goldFree = midpoint(silverFree, diamondFree);
    const uplift = Math.max(0, bronzePremium - bronzeFree);
    const withUplift = (free: number) => Math.min(RATE_MAX, free + uplift);

    visitsBase[s] = {
      bronze: { free: bronzeFree, premium: bronzePremium },
      silver: { free: silverFree, premium: withUplift(silverFree) },
      gold: { free: goldFree, premium: withUplift(goldFree) },
      diamond: { free: diamondFree, premium: withUplift(diamondFree) },
    };
  }

  return {
    version: 11,
    visits: {
      base: visitsBase,
      // A v10 blob has ONE flat bonus set; coerceBonuses fans it out to
      // every strategy, so the migrated config bills identically.
      bonuses: coerceBonuses(r.bonuses, d.visits.bonuses),
    },
    orders: structuredClone(d.orders),
    cap: snapCap(r.cap),
  };
}

// ── The additivity guard (mirrors rewards-config/promos.ts) ──────────────
//
// The admin page edits COMPONENTS (base + class step + plan step) and expands
// them into this grid before sending. Storage keeps the grid, so the two
// representations stay isomorphic only while the grid is additive. This
// module is the single writer, which is what makes that safe: an off-ladder
// grid is refused here, so the editor can never read back something it cannot
// represent.
//
// Two conditions. The second is the subtle one: class steps are OFFSETS FROM
// BASE, not rung-to-rung deltas, so "every step >= 0" does NOT prevent
// inversion (silver +15 with gold +5 are both non-negative and still invert).
// The real invariant is that offsets never decrease as the class climbs.

function deriveVisits(base: PromosConfigV11["visits"]["base"]) {
  const out = {} as Record<
    StrategyKey,
    { base: number; class: Record<ClassKey, number>; plan: Record<PlanKey, number> }
  >;
  for (const s of STRATEGY_KEYS) {
    const floor = base[s].bronze.free;
    out[s] = {
      base: floor,
      class: {
        bronze: 0,
        silver: base[s].silver.free - floor,
        gold: base[s].gold.free - floor,
        diamond: base[s].diamond.free - floor,
      },
      plan: { free: 0, premium: base[s].bronze.premium - floor },
    };
  }
  return out;
}

/** Returns null when the grid is a legal component grid, else why not. */
export function additivityError(
  base: PromosConfigV11["visits"]["base"],
): string | null {
  const components = deriveVisits(base);
  for (const s of STRATEGY_KEYS) {
    const c = components[s];
    for (const cls of CLASS_KEYS) {
      for (const p of PLAN_KEYS) {
        const expected = Math.max(
          0,
          Math.min(RATE_MAX, c.base + c.class[cls] + c.plan[p]),
        );
        if (expected !== base[s][cls][p]) {
          return `${s} ${cls} ${p} is ${base[s][cls][p]}%, but base + class + plan ` +
            `resolves to ${expected}% — rates are built from components, so a ` +
            `cell cannot be set on its own.`;
        }
      }
    }
    for (let i = 1; i < CLASS_KEYS.length; i++) {
      if (c.class[CLASS_KEYS[i]] < c.class[CLASS_KEYS[i - 1]]) {
        return `${s}: ${CLASS_KEYS[i]} adds ${c.class[CLASS_KEYS[i]]}% but ` +
          `${CLASS_KEYS[i - 1]} adds ${c.class[CLASS_KEYS[i - 1]]}% — the class ` +
          `ladder would invert.`;
      }
    }
    if (c.plan.premium < 0) {
      return `${s}: Premium adds ${c.plan.premium}% — the subscription would ` +
        `cost the guest money.`;
    }
  }
  return null;
}

/**
 * Coerce an unknown body into a complete v11 config. Returns an error for a
 * non-object payload, or for a grid that is not expressible as components
 * (the additivity guard — see above). Everything else resolves via defaults
 * and snapping, as before.
 */
export function normalizePromosV11(
  raw: unknown,
): { ok: true; value: PromosConfigV11 } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be an object" };
  }
  const r = raw as Record<string, unknown>;

  // A v10 blob (or anything still carrying a v10-shaped `base`) migrates.
  if (r.version === 10 || (r.base != null && r.visits == null)) {
    return { ok: true, value: migrateV10(r) };
  }

  const d = DEFAULT_PROMOS_V11;
  const visitsRaw = (r.visits ?? {}) as Record<string, unknown>;
  const ordersRaw = (r.orders ?? {}) as Record<string, unknown>;

  const visitsBase = structuredClone(d.visits.base);
  const rawVisitsBase = visitsRaw.base;
  if (rawVisitsBase && typeof rawVisitsBase === "object") {
    for (
      const [s, byClass] of Object.entries(
        rawVisitsBase as Record<string, unknown>,
      )
    ) {
      if (!isStrategy(s) || !byClass || typeof byClass !== "object") continue;
      for (
        const [c, byPlan] of Object.entries(byClass as Record<string, unknown>)
      ) {
        if (!isClass(c) || !byPlan || typeof byPlan !== "object") continue;
        for (
          const [p, v] of Object.entries(byPlan as Record<string, unknown>)
        ) {
          if (!isPlan(p)) continue;
          visitsBase[s][c][p] = snapRate(v, d.visits.base[s][c][p]);
        }
      }
    }
  }

  const ordersBase = structuredClone(d.orders.base);
  const rawOrdersBase = ordersRaw.base;
  if (rawOrdersBase && typeof rawOrdersBase === "object") {
    for (
      const [s, byPlan] of Object.entries(
        rawOrdersBase as Record<string, unknown>,
      )
    ) {
      if (!isStrategy(s) || !byPlan || typeof byPlan !== "object") continue;
      for (const [p, v] of Object.entries(byPlan as Record<string, unknown>)) {
        if (!isPlan(p)) continue;
        ordersBase[s][p] = snapRate(v, d.orders.base[s][p]);
      }
    }
  }

  // The guard runs on the COERCED grid, so snapping cannot smuggle a
  // non-additive cell past it.
  const guard = additivityError(visitsBase);
  if (guard) return { ok: false, error: guard };

  return {
    ok: true,
    value: {
      version: 11,
      visits: {
        base: visitsBase,
        bonuses: coerceBonuses(visitsRaw.bonuses, d.visits.bonuses),
      },
      orders: {
        base: ordersBase,
        bonuses: coerceBonuses(ordersRaw.bonuses, d.orders.bonuses),
        // Never trust a stored value to un-park orders.
        soon: true,
      },
      cap: snapCap(r.cap),
    },
  };
}

function bonusForAction(bonuses: ContextBonuses, action: ActionKey): number {
  switch (action) {
    case "standing":
      return 0;
    case "mesita_review":
      return bonuses.mesita;
    case "story":
      return bonuses.story;
    case "review":
      return bonuses.google;
    case "welcome":
      return bonuses.welcome;
  }
}

/**
 * Derive the complete 40-cell legacy best-of rule set from the v11 knobs —
 * cell = visits base for that legacy class's (class, plan) + the action's
 * bonus, clamped to the engine's 70% ceiling. Frozen mirror, kept as the
 * empty-config fallback.
 */
export function legacyRulesFromV11(cfg: PromosConfigV11): LegacyRuleRow[] {
  const rules: LegacyRuleRow[] = [];
  for (const strategy of STRATEGY_KEYS) {
    for (const legacy of LEGACY_CLASS_KEYS) {
      const { cls, plan } = LEGACY_CLASS_IDENTITY[legacy];
      for (const action of ACTION_KEYS) {
        rules.push({
          strategy,
          class: legacy,
          action,
          discount_percent: Math.min(
            RATE_MAX,
            cfg.visits.base[strategy][cls][plan] +
              bonusForAction(cfg.visits.bonuses[strategy], action),
          ),
        });
      }
    }
  }
  return rules;
}

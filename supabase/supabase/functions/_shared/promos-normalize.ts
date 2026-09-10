// Normalize the Promos Config v12 payload (MESITA-1705) — the strict-shape,
// lenient-values gate on save. Mirrors coercePromosConfig + legacyRulesFrom in
// web-admin app/(app)/rewards-config/promos.ts — keep them in lock-step.
//
// v12 DELETES THE PLAN AXIS (Pato, 2026-09-08). A reward resolves on three
// priced groups and nothing else:
//
//   rate = base + welcome + class step + every earned action bonus
//
//   CONTEXT cuts first — visits (local) or orders (remote).
//   CLASS is who you are: bronze < silver < gold < diamond. Never purchasable.
//
// What plan bought is gone from pricing entirely. Premium is still a sold
// subscription (`consumers.plan`), it just no longer moves the rate — it sells
// reservations, recommendations and subscriber terms on Credits instead. The
// probe that settled it: at the cutover there were 0 rows with plan='premium'
// and 0 with the legacy class_key='premium', so no bill and no guest moved.
//
// visits prices class alone; orders drops class too (presence can't be priced
// on a delivery order) and is a single scalar per strategy. ORDERS IS PARKED —
// the shape is stored and the operator can tune it, but no ticket carries a
// remote context yet, so the engine never reads those rates.
//
// Lenient by design (the MESITA-804 lesson): unknown keys drop, gaps fall
// back to defaults, every rate snaps to the 5% grid. The only hard error is a
// non-object body. A stored v10 or v11 blob MIGRATES rather than resetting.

const STRATEGY_KEYS = ["conservative", "aggressive", "dominant"] as const;
type StrategyKey = (typeof STRATEGY_KEYS)[number];

const CLASS_KEYS = ["bronze", "silver", "gold", "diamond"] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

const ACTION_KEYS = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
] as const;
type ActionKey = (typeof ACTION_KEYS)[number];

// The legacy class rows the derived best-of grid still speaks. Each maps onto
// one CLASS of the VISITS ladder — the legacy table has no context axis, and
// every ticket it ever priced was a visit.
//
// `premium` was never a class: it was bronze wearing the paid subscription as
// a costume, and under v11 it resolved to the bronze·premium cell. With the
// plan axis gone it resolves to plain bronze, which is what it always was
// underneath.
const LEGACY_CLASS_KEYS = ["standard", "influencer", "premium", "aura"] as const;
type LegacyClassKey = (typeof LEGACY_CLASS_KEYS)[number];

export const LEGACY_CLASS_IDENTITY: Record<LegacyClassKey, ClassKey> = {
  standard: "bronze",
  influencer: "silver",
  premium: "bronze",
  aura: "diamond",
};

/**
 * Resolve a stored `consumers.class_key` onto the one identity axis that
 * prices a reward.
 *
 * Metals (bronze/silver/gold/diamond) pass through. Leftover legacy keys
 * (standard/influencer/premium/aura) still map. Anything unknown floors at
 * bronze, so a class key from a future migration can never fail to price.
 */
export function identityForClassKey(
  key: string | null | undefined,
): { cls: ClassKey } {
  if (key && (CLASS_KEYS as readonly string[]).includes(key)) {
    return { cls: key as ClassKey };
  }
  const hit = (LEGACY_CLASS_KEYS as readonly string[]).includes(key ?? "")
    ? LEGACY_CLASS_IDENTITY[key as LegacyClassKey]
    : undefined;
  return { cls: hit ?? "bronze" };
}

/**
 * What a SAVE body's `config` claims to be.
 *
 * Read and write are deliberately asymmetric. `normalizePromos` still migrates
 * a v10 or v11 blob on READ, because a restored or reset `app_config` row can
 * legitimately hold one and a ticket must never fail to price. An OLD-VERSION
 * WRITE is a different animal: no shipped client produces one after the
 * migration lands, so it can only come from a stale browser tab whose bundle
 * predates it. That tab renders its own bundled DEFAULTS (it cannot parse a
 * v12 blob), so accepting its save would silently overwrite the live rates —
 * losing every operator tuning at once, and in v11's case reinstating a plan
 * axis this version deleted on purpose.
 */
export type PromosWriteShape = "v12" | "stale-v11" | "stale-v10" | "other";

export function promosWriteShape(rawConfig: unknown): PromosWriteShape {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return "other";
  }
  const version = (rawConfig as Record<string, unknown>).version;
  if (version === 12) return "v12";
  if (version === 11) return "stale-v11";
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

export type PromosConfigV12 = {
  version: 12;
  visits: {
    base: Record<StrategyKey, Record<ClassKey, number>>;
    bonuses: StrategyBonuses;
  };
  orders: {
    base: Record<StrategyKey, number>;
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

// The v12 defaults. Byte-identical to DEFAULT_PROMOS in the web-admin catalog.
//
// These are v11's FREE column exactly — the premium column is what v12 drops,
// so a place that never tuned its rates keeps billing the same number it did
// the day before the cutover.
export const DEFAULT_PROMOS_V12: PromosConfigV12 = {
  version: 12,
  visits: {
    base: {
      conservative: { bronze: 10, silver: 15, gold: 20, diamond: 25 },
      aggressive: { bronze: 20, silver: 30, gold: 40, diamond: 50 },
      // Additive by construction: floor 40, class steps 0/5/10/15. Must stay
      // byte-identical to the admin twin in rewards-config/promos.ts — they
      // are checked against each other.
      dominant: { bronze: 40, silver: 45, gold: 50, diamond: 55 },
    },
    bonuses: {
      conservative: { welcome: 10, mesita: 5, story: 10, google: 15 },
      aggressive: { welcome: 10, mesita: 5, story: 10, google: 15 },
      dominant: { welcome: 10, mesita: 10, story: 10, google: 15 },
    },
  },
  orders: {
    base: { conservative: 5, aggressive: 10, dominant: 15 },
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
 * A versionless blob still carries the plan axis when a visits class row is an
 * object. v12 rows are plain numbers, so this tells the two shapes apart
 * without trusting `version` — which a hand-edited app_config row may lack.
 */
function hasPlanLevel(r: Record<string, unknown>): boolean {
  const visits = r.visits;
  if (!visits || typeof visits !== "object") return false;
  const base = (visits as Record<string, unknown>).base;
  if (!base || typeof base !== "object") return false;
  for (const byClass of Object.values(base as Record<string, unknown>)) {
    if (!byClass || typeof byClass !== "object") continue;
    for (const cell of Object.values(byClass as Record<string, unknown>)) {
      if (cell && typeof cell === "object") return true;
    }
  }
  return false;
}

/**
 * Migrate a v11 blob: keep the FREE cell of every (strategy, class), discard
 * every premium cell.
 *
 * Free is the surviving column because it is what every guest was already
 * paying — at the cutover nobody held plan='premium', so the premium column
 * priced zero bills and dropping it moves no money. Orders, which priced plan
 * alone, keeps its free rate as the strategy's one scalar.
 */
function migrateV11(r: Record<string, unknown>): PromosConfigV12 {
  const d = DEFAULT_PROMOS_V12;
  const visitsRaw = (r.visits ?? {}) as Record<string, unknown>;
  const ordersRaw = (r.orders ?? {}) as Record<string, unknown>;

  const freeCell = (raw: unknown, s: StrategyKey, c: ClassKey): number => {
    const byStrategy = (raw ?? {}) as Record<string, unknown>;
    const byClass = byStrategy[s];
    if (!byClass || typeof byClass !== "object") return d.visits.base[s][c];
    const byPlan = (byClass as Record<string, unknown>)[c];
    if (!byPlan || typeof byPlan !== "object") return d.visits.base[s][c];
    return snapRate(
      (byPlan as Record<string, unknown>).free,
      d.visits.base[s][c],
    );
  };

  const visitsBase = structuredClone(d.visits.base);
  const ordersBase = structuredClone(d.orders.base);
  for (const s of STRATEGY_KEYS) {
    for (const c of CLASS_KEYS) {
      visitsBase[s][c] = freeCell(visitsRaw.base, s, c);
    }
    const row = ((ordersRaw.base ?? {}) as Record<string, unknown>)[s];
    ordersBase[s] = row && typeof row === "object"
      ? snapRate((row as Record<string, unknown>).free, d.orders.base[s])
      : d.orders.base[s];
  }

  return {
    version: 12,
    visits: {
      base: visitsBase,
      bonuses: coerceBonuses(visitsRaw.bonuses, d.visits.bonuses),
    },
    orders: {
      base: ordersBase,
      bonuses: coerceBonuses(ordersRaw.bonuses, d.orders.bonuses),
      soon: true,
    },
    cap: snapCap(r.cap),
  };
}

/**
 * Migrate a v10 blob straight to v12. The old four-class row set carried the
 * plan axis folded into the class list:
 *
 *   standard → bronze    influencer → silver    aura → diamond
 *   premium  → bronze, but priced with the subscription uplift baked in
 *
 * so the `premium` row is DROPPED rather than migrated: it was the plan
 * talking, and v12 does not price the plan. Gold — which has no v10 ancestor —
 * interpolates between silver and diamond, as it did in the v10→v11 migration.
 * The Influencer story override is dropped too; it keyed on a class that no
 * longer exists, and v12 prices no per-class bonus.
 */
function migrateV10(r: Record<string, unknown>): PromosConfigV12 {
  const d = DEFAULT_PROMOS_V12;
  const rawBase = (r.base ?? {}) as Record<string, unknown>;
  const legacyAt = (s: StrategyKey, c: LegacyClassKey): number | undefined => {
    const row = rawBase[s];
    if (!row || typeof row !== "object") return undefined;
    const v = (row as Record<string, unknown>)[c];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };

  const visitsBase = structuredClone(d.visits.base);
  for (const s of STRATEGY_KEYS) {
    const bronze = snapRate(legacyAt(s, "standard"), d.visits.base[s].bronze);
    const silver = snapRate(legacyAt(s, "influencer"), d.visits.base[s].silver);
    const diamond = snapRate(legacyAt(s, "aura"), d.visits.base[s].diamond);
    visitsBase[s] = {
      bronze,
      silver,
      gold: midpoint(silver, diamond),
      diamond,
    };
  }

  return {
    version: 12,
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

// ── The ladder guard (mirrors rewards-config/promos.ts) ──────────────────
//
// The admin page edits COMPONENTS (base + class step) and expands them into
// this grid before sending. Storage keeps the grid, so the two representations
// have to stay isomorphic. This module is the single writer, which is what
// makes that safe: an illegal grid is refused here, so the editor can never
// read back something it cannot represent.
//
// v11 checked TWO things: that every cell equalled base + class + plan, and
// that the class ladder did not invert. The first check DIED WITH THE PLAN
// AXIS (MESITA-1705) and is not carried forward: with one axis the grid is
// trivially expressible as base + per-class offset, because the offset is
// derived from the cell itself, so `base + (cell - base) === cell` holds for
// every value snapRate can produce. Keeping it would have been a test that
// cannot fail.
//
// What survives is the check that was always the real one: class steps are
// OFFSETS FROM BASE, not rung-to-rung deltas, so "every step >= 0" does NOT
// prevent inversion (silver +15 with gold +5 are both non-negative and still
// invert). The invariant is that offsets never decrease as the class climbs —
// a guest must never lose money by moving up a class.

function deriveVisits(base: PromosConfigV12["visits"]["base"]) {
  const out = {} as Record<
    StrategyKey,
    { base: number; class: Record<ClassKey, number> }
  >;
  for (const s of STRATEGY_KEYS) {
    const floor = base[s].bronze;
    out[s] = {
      base: floor,
      class: {
        bronze: 0,
        silver: base[s].silver - floor,
        gold: base[s].gold - floor,
        diamond: base[s].diamond - floor,
      },
    };
  }
  return out;
}

/** Returns null when the grid is a legal component grid, else why not. */
export function additivityError(
  base: PromosConfigV12["visits"]["base"],
): string | null {
  const components = deriveVisits(base);
  for (const s of STRATEGY_KEYS) {
    const c = components[s];
    for (let i = 1; i < CLASS_KEYS.length; i++) {
      if (c.class[CLASS_KEYS[i]] < c.class[CLASS_KEYS[i - 1]]) {
        return `${s}: ${CLASS_KEYS[i]} adds ${c.class[CLASS_KEYS[i]]}% but ` +
          `${CLASS_KEYS[i - 1]} adds ${c.class[CLASS_KEYS[i - 1]]}% — the class ` +
          `ladder would invert.`;
      }
    }
  }
  return null;
}

/**
 * Coerce an unknown body into a complete v12 config. Returns an error for a
 * non-object payload, or for a grid that is not expressible as components
 * (the additivity guard — see above). Everything else resolves via defaults
 * and snapping, as before.
 */
export function normalizePromos(
  raw: unknown,
): { ok: true; value: PromosConfigV12 } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be an object" };
  }
  const r = raw as Record<string, unknown>;

  // A v10 blob (or anything still carrying a v10-shaped `base`) migrates.
  if (r.version === 10 || (r.base != null && r.visits == null)) {
    return { ok: true, value: migrateV10(r) };
  }
  // A v11 blob is recognised by its version, or by a visits base whose class
  // rows are objects (the plan level) rather than numbers.
  if (r.version === 11 || hasPlanLevel(r)) {
    return { ok: true, value: migrateV11(r) };
  }

  const d = DEFAULT_PROMOS_V12;
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
      for (const [c, v] of Object.entries(byClass as Record<string, unknown>)) {
        if (!isClass(c)) continue;
        visitsBase[s][c] = snapRate(v, d.visits.base[s][c]);
      }
    }
  }

  const ordersBase = structuredClone(d.orders.base);
  const rawOrdersBase = ordersRaw.base;
  if (rawOrdersBase && typeof rawOrdersBase === "object") {
    for (
      const [s, v] of Object.entries(rawOrdersBase as Record<string, unknown>)
    ) {
      if (!isStrategy(s)) continue;
      ordersBase[s] = snapRate(v, d.orders.base[s]);
    }
  }

  // The guard runs on the COERCED grid, so snapping cannot smuggle a
  // non-additive cell past it.
  const guard = additivityError(visitsBase);
  if (guard) return { ok: false, error: guard };

  return {
    ok: true,
    value: {
      version: 12,
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
 * Derive the complete 20-cell legacy best-of rule set from the v12 knobs —
 * cell = visits base for that legacy class + the action's bonus, clamped to
 * the engine's 70% ceiling. Frozen mirror, kept as the empty-config fallback.
 */
export function legacyRulesFromV12(cfg: PromosConfigV12): LegacyRuleRow[] {
  const rules: LegacyRuleRow[] = [];
  for (const strategy of STRATEGY_KEYS) {
    for (const legacy of LEGACY_CLASS_KEYS) {
      const cls = LEGACY_CLASS_IDENTITY[legacy];
      for (const action of ACTION_KEYS) {
        rules.push({
          strategy,
          class: legacy,
          action,
          discount_percent: Math.min(
            RATE_MAX,
            cfg.visits.base[strategy][cls] +
              bonusForAction(cfg.visits.bonuses[strategy], action),
          ),
        });
      }
    }
  }
  return rules;
}

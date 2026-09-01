// Promos catalog — the v11 CONTEXT × IDENTITY model (MESITA-1069).
//
// v10 priced base(strategy × class) over standard/influencer/premium/aura.
// Notion Main §2.7–2.8 (Classes v2, 2026-08-15) retired that shape on two
// counts: `premium` was the paid SUBSCRIPTION wearing a class costume, and
// every rate was quoted as if a delivery order and a body in the room were
// the same purchase. v11 splits both axes apart:
//
//   CONTEXT cuts first — visits (local) or orders (remote).
//     · visits prices the full identity grid: class × plan (8 rows/strategy).
//       Presence is what class buys, so class only resolves here.
//     · orders drops class entirely — a Diamond guest ordering to their
//       apartment fills no room — and prices plan alone (2 rows/strategy).
//   CLASS is who you are: bronze < silver < gold < diamond. Never purchasable.
//   PLAN is what you pay: free | premium. Private — it never reaches the
//     floor, and the place only ever sees the resolved percent.
//
// ONE strategy per place governs BOTH ladders: picking Conservative or
// Aggressive writes the visits ladder and the orders ladder together, with no
// per-context tinkering (Notion §2.8, "Strategies write the ladder").
//
// ORDERS IS PARKED. The knobs, the blob shape and the UI all exist, but no
// ticket carries a remote context yet, so nothing reads orders rates. It is
// marked `soon` end-to-end rather than hidden — the structure ships first.
//
// Pure module on purpose — vitest can't import server-action chains (see
// promo-state.ts precedent), and the EF normalizer mirrors this file
// (admin-web-update-rewards-config/promos-v11-normalize.ts) — keep them in
// lock-step.

import {
  DEFAULT_DISCOUNT_CAP_MXN,
  DISCOUNT_CAPS_MXN,
  snapDiscountCap,
} from "@/lib/business/strategies";

export type StrategyKey = "conservative" | "aggressive" | "dominant";
/** Who you are. Never purchasable, always public (it prints on the Passport). */
export type ClassKey = "bronze" | "silver" | "gold" | "diamond";
/** What you pay. Private — never printed, never leaves the server. */
export type PlanKey = "free" | "premium";
/** Context cuts before anything else: a visit, or a remote order. */
export type ContextKey = "visits" | "orders";
export type BonusKey = "welcome" | "mesita" | "story" | "google";
export type ActionKey =
  | "standing"
  | "mesita_review"
  | "story"
  | "welcome"
  | "review";

export type ContextBonuses = Record<BonusKey, number>;

/** visits: the full identity grid — one rate per (strategy × class × plan). */
export type VisitsBase = Record<
  StrategyKey,
  Record<ClassKey, Record<PlanKey, number>>
>;
/** orders: class does not resolve remotely, so plan alone prices the row. */
export type OrdersBase = Record<StrategyKey, Record<PlanKey, number>>;

/**
 * Bonuses are per STRATEGY as well as per context: a place on Aggressive pays
 * more for a Google review than one on Conservative, exactly as it pays more
 * for standing. "Strategies write the ladder" means the WHOLE ladder, and the
 * four-box editor would otherwise bind two controls to one number.
 */
export type StrategyBonuses = Record<StrategyKey, ContextBonuses>;

export type PromosConfig = {
  version: 11;
  visits: { base: VisitsBase; bonuses: StrategyBonuses };
  orders: {
    base: OrdersBase;
    bonuses: StrategyBonuses;
    /** Always true today — the remote bill path does not exist yet. */
    soon: boolean;
  };
  cap: number;
};

export const STRATEGY_KEYS: readonly StrategyKey[] = [
  "conservative",
  "aggressive",
  "dominant",
];
/** Columns a place can pick. Dominant stays in the blob for leftover rows. */
export const LIVE_STRATEGY_KEYS = ["conservative", "aggressive"] as const;
// Worst → best. The ladder a guest climbs; rates must rise with it.
export const CLASS_KEYS: readonly ClassKey[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
];
export const PLAN_KEYS: readonly PlanKey[] = ["free", "premium"];
export const CONTEXT_KEYS: readonly ContextKey[] = ["visits", "orders"];
export const BONUS_KEYS: readonly BonusKey[] = [
  "welcome",
  "mesita",
  "story",
  "google",
];
// Wire order for the legacy rule list (matches the v8 EF contract).
export const ACTION_KEYS: readonly ActionKey[] = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
];

export const STRATEGY_META: Record<
  StrategyKey,
  { name: string; emoji: string; blurb: string }
> = {
  conservative: {
    name: "Conservative",
    emoji: "🌿",
    blurb: "A calm, sustainable discount.",
  },
  aggressive: {
    name: "Aggressive",
    emoji: "⚡",
    blurb: "Bold headlines to pull a crowd.",
  },
  dominant: {
    name: "Dominant",
    emoji: "👑",
    blurb: "Nearly the top rate for everyone, not just the best guests.",
  },
};

export const CONTEXT_META: Record<
  ContextKey,
  { name: string; emoji: string; blurb: string }
> = {
  visits: {
    name: "Visits",
    emoji: "🍽️",
    blurb: "A body in the room. Presence is the premium product.",
  },
  orders: {
    name: "Orders",
    emoji: "🛵",
    blurb: "A kitchen ticket with nobody in the chair.",
  },
};

export const CLASS_META: Record<
  ClassKey,
  { name: string; emoji: string; blurb: string }
> = {
  bronze: {
    name: "Bronze",
    emoji: "🥉",
    blurb: "The base class — everyone starts here; it sets the floor.",
  },
  silver: {
    name: "Silver",
    emoji: "🥈",
    blurb: "First step up — a verified Instagram at the entry reach band.",
  },
  gold: {
    name: "Gold",
    emoji: "🥇",
    blurb: "Real reach, or a direct invitation.",
  },
  diamond: {
    name: "Diamond",
    emoji: "💎",
    blurb: "Top of the ladder — the largest reach, the strongest invitations.",
  },
};

export const PLAN_META: Record<
  PlanKey,
  { name: string; emoji: string; blurb: string }
> = {
  free: {
    name: "Free",
    emoji: "○",
    blurb: "MX$0 — the whole product, genuinely usable without paying.",
  },
  premium: {
    name: "Premium",
    emoji: "◆",
    blurb: "MX$50/mo — the consumer revenue lever. Never shown to the place.",
  },
};

// Shared action vocabulary — consumed by manage-single's per-strategy matrix
// besides this page. "standing" is the base/None column.
export const ACTION_META: Record<ActionKey, { name: string; emoji: string }> = {
  standing: { name: "None (Standing)", emoji: "🎫" },
  mesita_review: { name: "Mesita Review", emoji: "🍽️" },
  story: { name: "Instagram Story", emoji: "📸" },
  welcome: { name: "Welcome Visit", emoji: "🚪" },
  review: { name: "Google Review", emoji: "⭐" },
};

export const BONUS_META: Record<
  BonusKey,
  { name: string; emoji: string; qualifier: string; group: "automatic" | "action" }
> = {
  welcome: {
    name: "Welcome",
    emoji: "🚪",
    // "Verified" on purpose — there is no reliable pre-create first-visit
    // detection; the bonus is granted at check time (decision D3-A).
    qualifier: "First verified ticket at the place",
    group: "automatic",
  },
  mesita: {
    name: "Mesita Review",
    emoji: "🍽️",
    qualifier: "In-app rating, one per guest per place",
    group: "action",
  },
  story: {
    name: "Instagram Story",
    emoji: "📸",
    qualifier: "Tagged story, repeatable, needs a connected handle",
    group: "action",
  },
  google: {
    name: "Google Review",
    emoji: "⭐",
    qualifier: "One-shot per guest per place — the top of the ladder",
    group: "action",
  },
};

// The 5% grid: off, then 5 → 70 in steps of 5.
const RATE_STEP = 5;
const RATE_FLOOR = 5;
/** The ceiling the engine pays on any single additive total. */
const RATE_MAX = 70;
export const ALLOWED_RATES: readonly number[] = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70,
];

// Default cap ladder — ONE ladder with the place-level monthly_promo_cap
// (#839): a place's own cap wins at bill time (#816); this knob is only the
// fallback. ALLOWED_CAPS stays as the client-facing alias.
export const ALLOWED_CAPS: readonly number[] = DISCOUNT_CAPS_MXN;
const CAP_DEFAULT = DEFAULT_DISCOUNT_CAP_MXN;

// ── The v11 defaults ─────────────────────────────────────────────────────
// Visits carry forward the v10 launch numbers exactly on the Free plan
// (bronze 10/20 · silver 15/30 · diamond 25/50), with Gold interpolated into
// the gap Classes v2 opened and the Premium plan taking the uplift the old
// `premium` CLASS row used to encode (+10 conservative / +20 aggressive).
//
// Orders is deliberately a flatter, lower band: remote buys volume, not
// presence, and it is funded out of the 25–30% a delivery app would have
// taken from the same order. These are placeholders until the remote bill
// path exists — nothing reads them (`soon`).
export const DEFAULT_PROMOS: PromosConfig = {
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
      // Dominant lifts the FLOOR, because it cannot lift the ceiling:
      // Aggressive already pays 70 at diamond·premium, and RATE_MAX is 70.
      // So the strategy is not "pay your best guests more" — they are already
      // capped — it is "pay everyone close to the top". A Bronze Free guest
      // goes 20 → 40; the whole ladder compresses upward into a narrow band.
      //
      // Additive by construction (additivityError blocks Save otherwise):
      // floor 40, class steps 0/5/10/15, one plan step of 15 for every class.
      // Strictly above Aggressive in seven of eight cells; the eighth is the
      // system's maximum, where nothing can be above anything.
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
      // Google still has to out-pay the repeatable Story (modelWarnings
      // enforces it: a Story a guest can post nightly must never beat a
      // one-shot review, or the program buys stories). Google is already at
      // the 15 the 95% worst case allows, so Story cannot rise past 10 and
      // Dominant's edge lives in its base floor, not here. Mesita review is
      // the one bonus with room: it is the review Mesita owns.
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

/** Snap any number to the 5% grid: ≤0 → 0, else clamp to [5,70] rounded to 5. */
export function snapRate(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
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

/**
 * Bonuses accept BOTH shapes. A stored blob written before bonuses gained the
 * strategy dimension is FLAT (`{welcome, mesita, story, google}`); it migrates
 * by copying that one set to every strategy, so no bill moves. No version bump
 * — the reader absorbs the difference.
 */
function coerceBonuses(raw: unknown, d: StrategyBonuses): StrategyBonuses {
  const b = (raw ?? {}) as Record<string, unknown>;
  const isFlat = STRATEGY_KEYS.every((s) => b[s] === undefined);
  const out = {} as StrategyBonuses;
  for (const s of STRATEGY_KEYS) {
    out[s] = coerceOneBonusSet(isFlat ? b : b[s], d[s]);
  }
  return out;
}

/**
 * Coerce whatever came off the wire into a complete v11 config. Lenient by
 * design (the MESITA-804 lesson): unknown keys drop, gaps fall back to the
 * defaults, every rate snaps to the grid. A stored v10 blob is migrated
 * rather than discarded, so the first load after deploy shows the operator's
 * real numbers instead of the launch defaults.
 */
export function coercePromosConfig(raw: unknown): PromosConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return structuredClone(DEFAULT_PROMOS);
  }
  const r = raw as Record<string, unknown>;

  // A v10 blob (or anything still carrying a v10-shaped `base`) migrates.
  if (r.version === 10 || (r.base != null && r.visits == null)) {
    return migrateV10(r);
  }

  const d = DEFAULT_PROMOS;
  const visitsRaw = (r.visits ?? {}) as Record<string, unknown>;
  const ordersRaw = (r.orders ?? {}) as Record<string, unknown>;

  const visitsBase = structuredClone(d.visits.base);
  const rawVisitsBase = visitsRaw.base;
  if (rawVisitsBase && typeof rawVisitsBase === "object") {
    for (const [s, byClass] of Object.entries(
      rawVisitsBase as Record<string, unknown>,
    )) {
      if (!isStrategy(s) || !byClass || typeof byClass !== "object") continue;
      for (const [c, byPlan] of Object.entries(
        byClass as Record<string, unknown>,
      )) {
        if (!isClass(c) || !byPlan || typeof byPlan !== "object") continue;
        for (const [p, v] of Object.entries(byPlan as Record<string, unknown>)) {
          if (!isPlan(p)) continue;
          visitsBase[s][c][p] = snapRate(v, d.visits.base[s][c][p]);
        }
      }
    }
  }

  const ordersBase = structuredClone(d.orders.base);
  const rawOrdersBase = ordersRaw.base;
  if (rawOrdersBase && typeof rawOrdersBase === "object") {
    for (const [s, byPlan] of Object.entries(
      rawOrdersBase as Record<string, unknown>,
    )) {
      if (!isStrategy(s) || !byPlan || typeof byPlan !== "object") continue;
      for (const [p, v] of Object.entries(byPlan as Record<string, unknown>)) {
        if (!isPlan(p)) continue;
        ordersBase[s][p] = snapRate(v, d.orders.base[s][p]);
      }
    }
  }

  return {
    version: 11,
    visits: {
      base: visitsBase,
      bonuses: coerceBonuses(visitsRaw.bonuses, d.visits.bonuses),
    },
    orders: {
      base: ordersBase,
      bonuses: coerceBonuses(ordersRaw.bonuses, d.orders.bonuses),
      // Orders stays parked until the remote bill path ships; the stored
      // value is never trusted to un-park it.
      soon: true,
    },
    cap: snapDiscountCap(r.cap),
  };
}

// ── v10 → v11 migration ──────────────────────────────────────────────────
//
// The old four-class row set carried BOTH axes at once. Splitting them:
//
//   standard   → bronze  · free       influencer → silver  · free
//   premium    → bronze  · premium    aura       → diamond · free
//
// so the Premium PLAN uplift is exactly what the old `premium` class row
// paid over `standard`, and it carries across every class. Gold — a class
// with no v10 ancestor — interpolates between silver and diamond. The
// Influencer story override is DROPPED: it keyed on a class that no longer
// exists, and v2 prices no per-class bonus.

type LegacyClassKey = "standard" | "influencer" | "premium" | "aura";

/** Snap to the 5% grid without the [5,70] floor/ceiling clamp of snapRate. */
function midpoint(a: number, b: number): number {
  return Math.round((a + b) / 2 / RATE_STEP) * RATE_STEP;
}

function migrateV10(r: Record<string, unknown>): PromosConfig {
  const d = DEFAULT_PROMOS;
  const rawBase = (r.base ?? {}) as Record<string, unknown>;
  const legacyAt = (s: StrategyKey, c: LegacyClassKey): number | undefined => {
    const row = rawBase[s];
    if (!row || typeof row !== "object") return undefined;
    const v = (row as Record<string, unknown>)[c];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };

  const visitsBase = structuredClone(d.visits.base);
  for (const s of STRATEGY_KEYS) {
    const bronzeFree = snapRate(legacyAt(s, "standard"), d.visits.base[s].bronze.free);
    const bronzePremium = snapRate(
      legacyAt(s, "premium"),
      d.visits.base[s].bronze.premium,
    );
    const silverFree = snapRate(
      legacyAt(s, "influencer"),
      d.visits.base[s].silver.free,
    );
    const diamondFree = snapRate(legacyAt(s, "aura"), d.visits.base[s].diamond.free);
    // Gold has no v10 ancestor — split the silver→diamond gap.
    const goldFree = midpoint(silverFree, diamondFree);
    // The Premium PLAN uplift is what `premium` used to pay over `standard`.
    const uplift = Math.max(0, bronzePremium - bronzeFree);
    const withUplift = (free: number) => Math.min(RATE_MAX, free + uplift);

    visitsBase[s] = {
      bronze: { free: bronzeFree, premium: bronzePremium },
      silver: { free: silverFree, premium: withUplift(silverFree) },
      gold: { free: goldFree, premium: withUplift(goldFree) },
      diamond: { free: diamondFree, premium: withUplift(diamondFree) },
    };
  }

  const b = (r.bonuses ?? {}) as Record<string, unknown>;
  return {
    version: 11,
    visits: {
      base: visitsBase,
      // story_influencer is deliberately not carried across.
      bonuses: coerceBonuses(b, d.visits.bonuses),
    },
    orders: structuredClone(d.orders),
    cap: snapDiscountCap(r.cap),
  };
}

// ── Derived reads ────────────────────────────────────────────────────────

/** The standing rate a (class, plan) pays on a visit under this strategy. */
export function visitsBaseFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  plan: PlanKey,
): number {
  return cfg.visits.base[strategy][cls][plan];
}

/** The bonus an action adds in a context (standing adds nothing). */
function bonusForAction(
  bonuses: ContextBonuses,
  action: ActionKey,
): number {
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
 * The additive total a (class, plan) guest earns for this single action on a
 * VISIT under this strategy — base + that action's bonus. A real bill stacks
 * several bonuses on one base; this per-action figure is what the preview
 * table shows and what the legacy best-of mirror cell stores.
 */
export function totalFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  plan: PlanKey,
  action: ActionKey,
): number {
  return (
    visitsBaseFor(cfg, strategy, cls, plan) +
    bonusForAction(cfg.visits.bonuses[strategy], action)
  );
}

// ── Components: the five-box editor's view of the stored grid ────────────
//
// The page edits COMPONENTS; storage keeps the GRID. The two are isomorphic
// as long as the grid is additive:
//
//   grid[s][class][plan] = base[s] + classStep[s][class] + planStep[s][plan]
//
// `bronze` and `free` are the zero rungs by definition, so a component set
// has 1 + 3 + 1 = 5 real knobs per strategy instead of 8 grid cells.
//
// STORAGE IS NOT CHANGING (D12). Deriving on read and expanding on write is
// only safe because exactly one writer exists and it validates: see
// additivityError below and its mirror in promos-v11-normalize.ts. An
// off-ladder grid is unstorable, so the editor can never mis-derive.

export type VisitsComponents = Record<
  StrategyKey,
  { base: number; class: Record<ClassKey, number>; plan: Record<PlanKey, number> }
>;
export type OrdersComponents = Record<
  StrategyKey,
  { base: number; plan: Record<PlanKey, number> }
>;

/** Grid → components. Exact when the grid is additive; the guard makes it so. */
export function deriveVisits(base: VisitsBase): VisitsComponents {
  const out = {} as VisitsComponents;
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

/** Components → grid, clamped to the engine ceiling. */
export function expandVisits(components: VisitsComponents): VisitsBase {
  const out = {} as VisitsBase;
  for (const s of STRATEGY_KEYS) {
    const c = components[s];
    out[s] = {} as VisitsBase[StrategyKey];
    for (const cls of CLASS_KEYS) {
      out[s][cls] = {} as Record<PlanKey, number>;
      for (const p of PLAN_KEYS) {
        out[s][cls][p] = Math.max(
          0,
          Math.min(RATE_MAX, c.base + c.class[cls] + c.plan[p]),
        );
      }
    }
  }
  return out;
}

export function deriveOrders(base: OrdersBase): OrdersComponents {
  const out = {} as OrdersComponents;
  for (const s of STRATEGY_KEYS) {
    out[s] = {
      base: base[s].free,
      plan: { free: 0, premium: base[s].premium - base[s].free },
    };
  }
  return out;
}

export function expandOrders(components: OrdersComponents): OrdersBase {
  const out = {} as OrdersBase;
  for (const s of STRATEGY_KEYS) {
    const c = components[s];
    out[s] = {
      free: Math.max(0, Math.min(RATE_MAX, c.base + c.plan.free)),
      premium: Math.max(0, Math.min(RATE_MAX, c.base + c.plan.premium)),
    };
  }
  return out;
}

/**
 * THE GUARD. Returns null when `base` is a legal component grid, else the
 * reason it is not. Two conditions, and the second is the subtle one:
 *
 *  1. ADDITIVE — expand(derive(g)) must reproduce g exactly. A cell that
 *     sits off the ladder cannot be represented by components, so storing it
 *     would make the five-box editor render something that is not the truth.
 *
 *  2. MONOTONIC — class steps are OFFSETS FROM BASE, not rung-to-rung
 *     deltas, so "every step >= 0" does NOT prevent inversion: silver +15
 *     with gold +5 are both non-negative and still invert the ladder. The
 *     real invariant is that the offsets never decrease as the class climbs,
 *     and that the premium plan never pays less than free.
 *
 * This is what lets the class-order and plan-uplift modelWarnings retire:
 * behind the guard those states are unstorable rather than merely reported.
 */
export function additivityError(base: VisitsBase): string | null {
  const rebuilt = expandVisits(deriveVisits(base));
  for (const s of STRATEGY_KEYS) {
    for (const cls of CLASS_KEYS) {
      for (const p of PLAN_KEYS) {
        if (rebuilt[s][cls][p] !== base[s][cls][p]) {
          return (
            `${STRATEGY_META[s].name} · ${CLASS_META[cls].name} · ${PLAN_META[p].name} ` +
            `is ${base[s][cls][p]}%, but base + class + plan resolves to ` +
            `${rebuilt[s][cls][p]}%. Rates are built from components; a cell ` +
            `cannot be set on its own.`
          );
        }
      }
    }
  }

  const components = deriveVisits(base);
  for (const s of STRATEGY_KEYS) {
    const c = components[s];
    for (let i = 1; i < CLASS_KEYS.length; i++) {
      const lower = CLASS_KEYS[i - 1];
      const upper = CLASS_KEYS[i];
      if (c.class[upper] < c.class[lower]) {
        return (
          `${STRATEGY_META[s].name}: ${CLASS_META[upper].name} adds ` +
          `${c.class[upper]}% but ${CLASS_META[lower].name} adds ${c.class[lower]}% — ` +
          `the class ladder would invert.`
        );
      }
    }
    if (c.plan.premium < 0) {
      return (
        `${STRATEGY_META[s].name}: Premium adds ${c.plan.premium}% — ` +
        `the subscription would cost the guest money.`
      );
    }
  }
  return null;
}

// ── Model warnings (surfaced inline, never auto-corrected) ───────────────
//
// The page REPORTS invariant breaks instead of silently repairing them:
// these are money, and the operator decides.
//
// Only ONE check survives. Class monotonicity and the plan uplift used to
// live here as warnings; behind additivityError they are UNSTORABLE, so
// warning about them would be theatre. Google-vs-Story is different: it is a
// policy the operator can legitimately break (Notion §2.8.4 says the one-shot
// rung must out-pay the repeatable one), so it is reported, never enforced.

export type ModelWarning = { key: string; message: string };

export function modelWarnings(cfg: PromosConfig): ModelWarning[] {
  const out: ModelWarning[] = [];
  for (const s of STRATEGY_KEYS) {
    const b = cfg.visits.bonuses[s];
    if (b.google <= b.story) {
      out.push({
        key: `google-vs-story-${s}`,
        message:
          `${STRATEGY_META[s].name} · Google Review (${b.google}%) should ` +
          `out-pay Instagram Story (${b.story}%) — Google is one-shot per ` +
          `guest, the Story repeats.`,
      });
    }
  }
  return out;
}

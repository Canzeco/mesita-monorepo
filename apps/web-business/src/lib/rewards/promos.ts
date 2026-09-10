// Promos catalog — the v12 CONTEXT × CLASS model (MESITA-1705).
//
// v12 DELETES THE PLAN AXIS (Pato, 2026-09-08). A reward is three priced
// groups and nothing else:
//
//   rate = base + welcome + class step + every earned action bonus
//
//   CONTEXT cuts first — visits (local) or orders (remote).
//     · visits prices class: bronze < silver < gold < diamond, one row each.
//       Presence is what class buys, so class only resolves here.
//     · orders drops class entirely — a Diamond guest ordering to their
//       apartment fills no room — and is one scalar per strategy.
//   CLASS is who you are. Never purchasable.
//
// Premium is still SOLD (MX$50/mo) and still carries perks — reservations,
// recommendations, subscriber terms on Credits — it just no longer moves a
// rate. It priced zero bills when this landed: the cutover probe found 0 rows
// on plan='premium' and 0 on the legacy class_key='premium'.
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
// (supabase _shared/promos-normalize.ts) — keep them in
// lock-step.

import {
  DEFAULT_DISCOUNT_CAP_MXN,
  DISCOUNT_CAPS_MXN,
  snapDiscountCap,
} from "@/lib/business/strategies";

export type StrategyKey = "conservative" | "aggressive" | "dominant";
/** Who you are. Never purchasable, always public (it prints on the Passport). */
export type ClassKey = "bronze" | "silver" | "gold" | "diamond";
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

/** visits: one rate per (strategy × class). */
export type VisitsBase = Record<StrategyKey, Record<ClassKey, number>>;
/** orders: class does not resolve remotely and plan prices nothing, so a
 *  remote row is a single scalar per strategy. Parked either way. */
export type OrdersBase = Record<StrategyKey, number>;

/**
 * Bonuses are per STRATEGY as well as per context: a place on Aggressive pays
 * more for a Google review than one on Conservative, exactly as it pays more
 * for standing. "Strategies write the ladder" means the WHOLE ladder, and the
 * four-box editor would otherwise bind two controls to one number.
 */
export type StrategyBonuses = Record<StrategyKey, ContextBonuses>;

export type PromosConfig = {
  version: 12;
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

// ── The v12 defaults ─────────────────────────────────────────────────────
// These are v11's FREE column exactly. The premium column is what v12 drops,
// so a place that never tuned its rates keeps billing, to the percent, what
// it billed the day before the cutover.
//
// Orders is deliberately a flatter, lower band: remote buys volume, not
// presence, and it is funded out of the 25–30% a delivery app would have
// taken from the same order. These are placeholders until the remote bill
// path exists — nothing reads them (`soon`).
export const DEFAULT_PROMOS: PromosConfig = {
  version: 12,
  visits: {
    base: {
      conservative: { bronze: 10, silver: 15, gold: 20, diamond: 25 },
      aggressive: { bronze: 20, silver: 30, gold: 40, diamond: 50 },
      // Dominant lifts the FLOOR. It is not "pay your best guests more" —
      // it is "pay everyone close to the top": a Bronze guest goes 20 → 40
      // and the whole ladder compresses upward into a narrow band.
      //
      // Additive by construction (additivityError blocks Save otherwise):
      // floor 40, class steps 0/5/10/15. Strictly above Aggressive at every
      // class.
      dominant: { bronze: 40, silver: 45, gold: 50, diamond: 55 },
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
 * Coerce whatever came off the wire into a complete v12 config. Lenient by
 * design (the MESITA-804 lesson): unknown keys drop, gaps fall back to the
 * defaults, every rate snaps to the grid. A stored v10 or v11 blob is
 * migrated rather than discarded, so the first load after deploy shows the
 * operator's real numbers instead of the launch defaults.
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
  // A v11 blob is recognised by its version, or by a class row that is an
  // object (the plan level) rather than a number — a hand-edited app_config
  // row can lose `version`.
  if (r.version === 11 || hasPlanLevel(r)) {
    return migrateV11(r);
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
      for (const [c, v] of Object.entries(byClass as Record<string, unknown>)) {
        if (!isClass(c)) continue;
        visitsBase[s][c] = snapRate(v, d.visits.base[s][c]);
      }
    }
  }

  const ordersBase = structuredClone(d.orders.base);
  const rawOrdersBase = ordersRaw.base;
  if (rawOrdersBase && typeof rawOrdersBase === "object") {
    for (const [s, v] of Object.entries(
      rawOrdersBase as Record<string, unknown>,
    )) {
      if (!isStrategy(s)) continue;
      ordersBase[s] = snapRate(v, d.orders.base[s]);
    }
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
      // Orders stays parked until the remote bill path ships; the stored
      // value is never trusted to un-park it.
      soon: true,
    },
    cap: snapDiscountCap(r.cap),
  };
}

// ── Migrations into v12 ──────────────────────────────────────────────────
//
// v11 → v12 keeps the FREE cell of every (strategy, class) and drops every
// premium cell: free is what every guest was actually paying, so nothing
// moves. Orders, which priced plan alone, keeps its free rate as the one
// scalar.
//
// v10 → v12 maps the old four-class row set onto classes:
//
//   standard → bronze    influencer → silver    aura → diamond
//
// and DROPS `premium` outright. That row was the subscription wearing a class
// costume, and v12 does not price the plan, so folding it in as an uplift
// would smuggle the deleted axis back. Gold — a class with no v10 ancestor —
// interpolates between silver and diamond. The Influencer story override is
// dropped too: it keyed on a class that no longer exists.

type LegacyClassKey = "standard" | "influencer" | "premium" | "aura";

/** Snap to the 5% grid without the [5,70] floor/ceiling clamp of snapRate. */
function midpoint(a: number, b: number): number {
  return Math.round((a + b) / 2 / RATE_STEP) * RATE_STEP;
}

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

function migrateV11(r: Record<string, unknown>): PromosConfig {
  const d = DEFAULT_PROMOS;
  const visitsRaw = (r.visits ?? {}) as Record<string, unknown>;
  const ordersRaw = (r.orders ?? {}) as Record<string, unknown>;

  const freeCell = (raw: unknown, s: StrategyKey, c: ClassKey): number => {
    const byClass = ((raw ?? {}) as Record<string, unknown>)[s];
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
    for (const cls of CLASS_KEYS) {
      visitsBase[s][cls] = freeCell(visitsRaw.base, s, cls);
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
    cap: snapDiscountCap(r.cap),
  };
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
    const bronze = snapRate(legacyAt(s, "standard"), d.visits.base[s].bronze);
    const silver = snapRate(legacyAt(s, "influencer"), d.visits.base[s].silver);
    const diamond = snapRate(legacyAt(s, "aura"), d.visits.base[s].diamond);
    // Gold has no v10 ancestor — split the silver→diamond gap.
    visitsBase[s] = { bronze, silver, gold: midpoint(silver, diamond), diamond };
  }

  const b = (r.bonuses ?? {}) as Record<string, unknown>;
  return {
    version: 12,
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

/** The standing rate a class pays on a visit under this strategy. */
export function visitsBaseFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
): number {
  return cfg.visits.base[strategy][cls];
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
 * The additive total a class of guest earns for this single action on a VISIT
 * under this strategy — base + that action's bonus. A real bill stacks
 * several bonuses on one base; this per-action figure is what the preview
 * table shows and what the legacy best-of mirror cell stores.
 */
export function totalFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  action: ActionKey,
): number {
  return (
    visitsBaseFor(cfg, strategy, cls) +
    bonusForAction(cfg.visits.bonuses[strategy], action)
  );
}

// ── Components: the editor's view of the stored grid ─────────────────────
//
// The page edits COMPONENTS; storage keeps the GRID:
//
//   grid[s][class] = base[s] + classStep[s][class]
//
// `bronze` is the zero rung by definition, so a component set has 1 + 3 = 4
// real knobs per strategy for 4 grid cells. With the plan axis gone the two
// representations are trivially isomorphic — see additivityError.
//
// Deriving on read and expanding on write is only safe because exactly one
// writer exists and it validates: see additivityError below and its mirror in
// promos-normalize.ts. An inverted ladder is unstorable, so the editor can
// never mis-derive.
//
// ORDERS HAS NO COMPONENTS ANY MORE. It was `base + planStep`; with plan gone
// a remote row is one number, so the derive/expand pair for it was deleted
// rather than kept as an identity function.

export type VisitsComponents = Record<
  StrategyKey,
  { base: number; class: Record<ClassKey, number> }
>;

/** Grid → components. Exact for any on-grid value. */
export function deriveVisits(base: VisitsBase): VisitsComponents {
  const out = {} as VisitsComponents;
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

/** Components → grid, clamped to the engine ceiling. */
export function expandVisits(components: VisitsComponents): VisitsBase {
  const out = {} as VisitsBase;
  for (const s of STRATEGY_KEYS) {
    const c = components[s];
    out[s] = {} as VisitsBase[StrategyKey];
    for (const cls of CLASS_KEYS) {
      out[s][cls] = Math.max(0, Math.min(RATE_MAX, c.base + c.class[cls]));
    }
  }
  return out;
}

/**
 * THE GUARD. Returns null when `base` is a legal ladder, else the reason it
 * is not.
 *
 * v11 checked TWO things: that expand(derive(g)) reproduced g exactly, and
 * that the ladder did not invert. The first check DIED WITH THE PLAN AXIS
 * (MESITA-1705) and is deliberately not carried forward — with one axis the
 * class offset is derived from the cell itself, so `base + (cell - base)`
 * reproduces every value snapRate can emit. Keeping it would have been a
 * check that cannot fail.
 *
 * MONOTONICITY is what was always doing the work. Class steps are OFFSETS
 * FROM BASE, not rung-to-rung deltas, so "every step >= 0" does NOT prevent
 * inversion: silver +15 with gold +5 are both non-negative and still invert
 * the ladder. The invariant is that offsets never decrease as the class
 * climbs — a guest must never lose money by moving up.
 *
 * The name stays `additivityError` because it is what PromosState and the EF
 * normalizer both call; the twin in promos-normalize.ts carries the same
 * shape.
 */
export function additivityError(base: VisitsBase): string | null {
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
  }
  return null;
}

// ── Model warnings (surfaced inline, never auto-corrected) ───────────────
//
// The page REPORTS invariant breaks instead of silently repairing them:
// these are money, and the operator decides.
//
// Only ONE check survives. Class monotonicity used to live here as a warning;
// behind additivityError it is UNSTORABLE, so warning about it would be
// theatre. Google-vs-Story is different: it is a
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

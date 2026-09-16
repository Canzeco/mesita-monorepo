// THE REWARD LADDER, AND THE FACT THAT IT ADDS UP.
//
// The bill engine has resolved a ticket ADDITIVELY since v12 (MESITA-1705,
// supabase `_shared/rewards-config.ts`):
//
//   rate = base + welcome + class step + every earned action bonus
//
// clamped at 100%, then bounded in pesos by the place's cap. Nine priced rungs,
// added. A console that prints ONE number for that is describing a different
// product, which is what this page did until MESITA-1923.
//
// ── BASE IS NOT CLASS ──────────────────────────────────────────────────────
//
// Storage keeps one number per (strategy × class) — `grid[class]` — but the
// operator EDITS two: a base and a class step, with bronze pinned at zero
// (web-admin `rewards-config/promos.ts`, Components section):
//
//   grid[s][class] = base[s] + classStep[s][class]
//
// The two are trivially isomorphic, and only the split form can be a table: you
// cannot show Base as a row if Base is welded to Bronze. Base 20% + Diamond
// +30% is exactly the 50% that ships today.
//
// ── WHERE THE NUMBERS COME FROM ────────────────────────────────────────────
//
// The base ladder and the three action bonuses are the shipped `DEFAULT_PROMOS`
// decomposed (web-business `lib/rewards/promos.ts`), with ONE proposal on top:
// Conservative steps one grid stop below Aggressive on Welcome, Story and
// Google. That direction is forced, not chosen. The live defaults ship the two
// strategies with byte-identical bonuses, and the ceiling is pinned from above
// — Google sits at the 15 its 95% worst case allows, and Story may not pass 10,
// because a story a guest can post nightly must never out-pay a review they can
// only leave once. There is no room above; there is room below.
//
// Mesita review is the exception: flat on both columns, exactly as it ships.
// That is not an oversight and not a bug — see MESITA-1921, which asks whether
// the rung is a product at all, given no guest surface lists it.

/** What a place can set. `off` is the absence of the program, not the bottom of
 *  its ladder: an action whose bonus is 0 is not offered, which is what
 *  `offersAction()` reads in the real engine. */
export type Rung = "off" | "conservative" | "aggressive";
export type PaidRung = Exclude<Rung, "off">;

export const RUNGS: readonly Rung[] = ["off", "conservative", "aggressive"];
export const RUNG_LABEL: Record<Rung, string> = {
  off: "Off",
  conservative: "Conservative",
  aggressive: "Aggressive",
};

/** Who the guest is. Never purchasable, always public — it prints on their
 *  Passport, and it is the only axis the base is priced against. */
export type ClassKey = "bronze" | "silver" | "gold" | "diamond";
export const CLASS_KEYS: readonly ClassKey[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
];
export const CLASS_LABEL: Record<ClassKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

export type ActionKey = "mesita" | "story" | "google";

/** The standing rate every guest gets on every visit, before class. */
export const BASE: Record<PaidRung, number> = {
  conservative: 10,
  aggressive: 20,
};

/** First ever visit to this place. Once per guest, forever. */
export const WELCOME: Record<PaidRung, number> = {
  conservative: 5,
  aggressive: 10,
};

/** What class ADDS to the base. Bronze is the zero rung by definition. */
export const CLASS_STEP: Record<PaidRung, Record<ClassKey, number>> = {
  conservative: { bronze: 0, silver: 5, gold: 10, diamond: 15 },
  aggressive: { bronze: 0, silver: 10, gold: 20, diamond: 30 },
};

/** Earned at the table. Every one a guest earns is added. */
export const ACTION: Record<ActionKey, Record<PaidRung, number>> = {
  mesita: { conservative: 5, aggressive: 5 },
  story: { conservative: 5, aggressive: 10 },
  google: { conservative: 10, aggressive: 15 },
};

/** One row of the ladder. `band` rows carry no rate; they label the group. */
export type LadderRow =
  | { band: string }
  | {
      key: string;
      name: string;
      hint: string;
      /** Base is the floor; everything else is an adder and wears a `+`. */
      signed: boolean;
      /** Bronze adds nothing BY DEFINITION, so it prints an em dash at every
       *  rung. A zero is a rate; an em dash is "this rung adds nothing". */
      pinned?: boolean;
      rate: (rung: PaidRung) => number;
    };

export const LADDER: readonly LadderRow[] = [
  { band: "Standing" },
  {
    key: "base",
    name: "Base",
    hint: "Every guest, every visit",
    signed: false,
    rate: (r) => BASE[r],
  },
  {
    key: "welcome",
    name: "Welcome",
    hint: "Their first ever visit here. Once per guest",
    signed: true,
    rate: (r) => WELCOME[r],
  },
  { band: "Class" },
  ...CLASS_KEYS.map((c) => ({
    key: `class.${c}`,
    name: CLASS_LABEL[c],
    hint:
      c === "bronze"
        ? "The floor class. Adds nothing by definition"
        : c === "silver"
          ? "2,000+ Instagram followers"
          : c === "gold"
            ? "A higher reach band"
            : "20,000+ followers, or a direct invite",
    signed: true,
    pinned: c === "bronze",
    rate: (r: PaidRung) => CLASS_STEP[r][c],
  })),
  { band: "Actions" },
  {
    key: "action.mesita",
    name: "Mesita review",
    hint: "Once per place. Flat across strategies today",
    signed: true,
    rate: (r) => ACTION.mesita[r],
  },
  {
    key: "action.story",
    name: "Instagram story",
    hint: "Tagged, at the table, verified. Repeatable",
    signed: true,
    rate: (r) => ACTION.story[r],
  },
  {
    key: "action.google",
    name: "Google review",
    hint: "Once per place, and it stays up after they leave",
    signed: true,
    rate: (r) => ACTION.google[r],
  },
];

// ── The cap ────────────────────────────────────────────────────────────────
//
// A percentage is not a peso. Every rate applies to the FIRST cap-pesos of the
// bill, which is what keeps a 90% ceiling from being a 90% night: at MX$500 the
// most generous guest there is costs MX$450, whatever they ordered. The three
// legal caps are the product's (`DISCOUNT_CAPS_MXN`, web-business
// `lib/business/strategies.ts`).

export const CAPS_MXN = [200, 500, 1000] as const;
export type CapMxn = (typeof CAPS_MXN)[number];
export const DEFAULT_CAP: CapMxn = 500;

/** The most a percentage can cost at this cap, in CENTAVOS — money is an
 *  integer until the moment it is printed. `cap * pct` is `cap * 100 * pct/100`
 *  with the round-trip removed. */
export function capCostCents(pct: number, cap: CapMxn): number {
  return cap * pct;
}

// ── The stack ──────────────────────────────────────────────────────────────
//
// The climb, in the order the engine adds: base and class first (they always
// fire), then Welcome, then each action. Every step is a RUNNING total, which
// is what makes reading a row left to right the same act as adding.

export type StepKey = "base" | "welcome" | "story" | "google" | "mesita";
export const STEPS: readonly { key: StepKey; label: string }[] = [
  { key: "base", label: "Base" },
  { key: "welcome", label: "+ Welcome" },
  { key: "story", label: "+ Story" },
  { key: "google", label: "+ Google" },
  { key: "mesita", label: "+ Mesita" },
];

/** The five running totals for one class, clamped exactly as the engine clamps. */
export function stack(rung: Rung, cls: ClassKey): number[] {
  if (rung === "off") return STEPS.map(() => 0);
  const clamp = (n: number) => Math.min(100, n);
  let t = BASE[rung] + CLASS_STEP[rung][cls];
  const out = [clamp(t)];
  t += WELCOME[rung];
  out.push(clamp(t));
  t += ACTION.story[rung];
  out.push(clamp(t));
  t += ACTION.google[rung];
  out.push(clamp(t));
  t += ACTION.mesita[rung];
  out.push(clamp(t));
  return out;
}

/** The most any guest can reach: Diamond, first visit, every action earned. */
export function ceiling(rung: Rung): number {
  const row = stack(rung, "diamond");
  return row[row.length - 1];
}

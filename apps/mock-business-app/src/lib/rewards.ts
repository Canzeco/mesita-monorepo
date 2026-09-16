// THE FOUR STRATEGIES, AND THE FACT THAT THEY ADD UP.
//
// Rewards is not one dial. The bill engine has resolved a ticket ADDITIVELY
// since v12 (MESITA-1705, supabase `_shared/rewards-config.ts`):
//
//   rate = base(strategy × class) + welcome + story + google + mesita
//
// so a first visit by a Diamond guest who posts a story and leaves a Google
// review is not "the rate" — it is four rungs stacked on the same bill. A
// console that prints ONE number for that is not simplifying the product, it
// is describing a different one.
//
// ── WHY EACH REASON GETS ITS OWN STRATEGY ──────────────────────────────────
//
// A place picks one strategy today and that strategy writes every row at once.
// It barely moves four of them: the live defaults (`DEFAULT_PROMOS`, web-business
// `lib/rewards/promos.ts`) ship Conservative and Aggressive with byte-identical
// bonuses — `{ welcome: 10, mesita: 5, story: 10, google: 15 }` on both — even
// though the file beside them says "a place on Aggressive pays more for a Google
// review than one on Conservative". They are v11's free column, carried across
// the cutover so nobody's bill changed that day, and never re-laddered since.
// One control bound to four numbers, three of which it cannot change.
//
// ── THE NUMBERS BELOW, AND WHAT THEY ARE ALLOWED TO BE ─────────────────────
//
// The class base is the SHIPPED ladder, unchanged. The three bonuses are this
// page's proposal, and they move DOWNWARD from what ships: Aggressive keeps the
// live number and Conservative steps one grid stop below it. That direction is
// forced, not chosen. The model pins the CEILING of both bonuses — Google sits
// at the 15 its 95% worst case allows, and Story may not pass 10, because a
// story a guest can post nightly must never out-pay a review they can only
// leave once. There is no room above; there is room below. So Conservative
// becomes the cheaper posture it always claimed to be.
//
// Every rung here is on the engine's 5% grid, Aggressive ≥ Conservative in every
// row, and Google out-pays Story at both rungs.
//
// Class is priced ONCE, in the base. None of the three bonuses vary by class —
// that is the v12 model, not an omission here: the per-class story override was
// deleted with the `influencer` class it keyed on.

/** What one strategy can be set to. `off` is the absence of that reason, not
 *  the bottom of its ladder — an action whose bonus is 0 is not offered at all,
 *  which is exactly what `offersAction()` reads in the real engine. */
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

/** The four things a place pays for. `class` is the standing rate every guest
 *  gets on every visit; the other three are earned, once each, on top of it. */
export type ReasonKey = "class" | "welcome" | "story" | "google";
export const REASON_KEYS: readonly ReasonKey[] = [
  "class",
  "welcome",
  "story",
  "google",
];

/** The shipped base ladder (visits), unchanged from `DEFAULT_PROMOS`. */
export const CLASS_BASE: Record<PaidRung, Record<ClassKey, number>> = {
  conservative: { bronze: 10, silver: 15, gold: 20, diamond: 25 },
  aggressive: { bronze: 20, silver: 30, gold: 40, diamond: 50 },
};

/** The three bonuses. Aggressive is the live number; Conservative is one 5%
 *  stop below it — see the header for why the ladder can only grow downward. */
export const BONUS: Record<
  Exclude<ReasonKey, "class">,
  Record<PaidRung, number>
> = {
  welcome: { conservative: 5, aggressive: 10 },
  story: { conservative: 5, aggressive: 10 },
  google: { conservative: 10, aggressive: 15 },
};

export type Reason = {
  key: ReasonKey;
  name: string;
  /** How a guest lands on this rung — one line, in the guest's terms. */
  earns: string;
};

export const REASONS: readonly Reason[] = [
  {
    key: "class",
    name: "Class",
    earns:
      "Every guest, every visit. The only rung priced by who the guest is — Bronze through Diamond.",
  },
  {
    key: "welcome",
    name: "Welcome",
    earns: "Their first ever visit to this place. Once per guest, forever.",
  },
  {
    key: "story",
    name: "Instagram story",
    earns:
      "A tagged story, posted at the table and verified. Repeatable — a guest can earn it every visit.",
  },
  {
    key: "google",
    name: "Google review",
    earns:
      "A review left at the table. Once per place, and it stays up after they leave.",
  },
];

/** What every strategy is set to. */
export type Picks = Record<ReasonKey, Rung>;

/** What a place that has never touched this page is running: the live defaults
 *  — Conservative base, every bonus on at its live number. */
export const DEFAULT_PICKS: Picks = {
  class: "conservative",
  welcome: "aggressive",
  story: "aggressive",
  google: "aggressive",
};

export const ALL_OFF: Picks = {
  class: "off",
  welcome: "off",
  story: "off",
  google: "off",
};

/** What one reason pays at one rung, for one class. Off is 0 — and 0 means the
 *  rung is not offered, not that it pays nothing. */
export function rateFor(key: ReasonKey, rung: Rung, cls: ClassKey): number {
  if (rung === "off") return 0;
  return key === "class" ? CLASS_BASE[rung][cls] : BONUS[key][rung];
}

/** What a guest earned on this visit. Everything true here is added. */
export type Earned = {
  firstVisit: boolean;
  story: boolean;
  google: boolean;
};

export type StackTerm = { key: ReasonKey; name: string; rate: number };

/** The bill engine's arithmetic, on the picks above: every reason the guest
 *  earned, added, clamped at 100. The peso cap is what actually bounds the
 *  money, and this console does not set it yet — see the page. */
export function stack(
  picks: Picks,
  cls: ClassKey,
  earned: Earned,
): { terms: StackTerm[]; total: number } {
  const taken: ReasonKey[] = ["class"];
  if (earned.firstVisit) taken.push("welcome");
  if (earned.story) taken.push("story");
  if (earned.google) taken.push("google");

  const terms = taken
    .map((key) => ({
      key,
      name: REASONS.find((r) => r.key === key)!.name,
      rate: rateFor(key, picks[key], cls),
    }))
    .filter((t) => t.rate > 0);

  const total = Math.min(
    100,
    terms.reduce((sum, t) => sum + t.rate, 0),
  );
  return { terms, total };
}

/** The most any guest can reach on these picks: Diamond, first visit, story
 *  posted, review left. The number an owner needs to have seen BEFORE they set
 *  four dials independently — it is the one thing four separate controls hide. */
export function ceiling(picks: Picks): number {
  return stack(picks, "diamond", {
    firstVisit: true,
    story: true,
    google: true,
  }).total;
}

export function countOn(picks: Picks): number {
  return REASON_KEYS.filter((k) => picks[k] !== "off").length;
}

import {
  Award,
  CreditCard,
  Gem,
  Medal,
  Pyramid,
  Trophy,
  type LucideIcon,
} from "lucide-react";

// ── Classes v2 (MESITA-1039; surfaced here by MESITA-1079) ─────────────────
//
// TWO INDEPENDENT AXES, and the entire point of v2 is that they never merge:
//
//   class — WHO YOU ARE. Bronze → Silver → Gold → Diamond, ascending, and
//           never purchasable. Two doors up: Instagram reach (follower bands,
//           operator-configured) or a direct invitation. Class is public —
//           it shows on the Passport.
//   plan  — WHAT YOU PAY. Free or Premium (MX$50/mo). Private from the
//           BUSINESS side: a place never learns it. It DOES show to the guest
//           on their own Passport, in a Plan tile beside Class — the two axes
//           render side by side and never MERGE (a class tile can never say
//           Premium, a plan tile can never say a metal).
//
// The retired v1 ladder was standard < influencer < premium < aura, which put
// the paid subscription INSIDE the class ladder — "Premium" ranked above
// "Influencer" as if money were reach. That merge is what this replaces, and
// it is why `plan` is a separate type rather than a fifth class.
export const CLASS_ORDER = ["bronze", "silver", "gold", "diamond"] as const;
export type ClassKey = (typeof CLASS_ORDER)[number];

export const PLAN_ORDER = ["free", "premium"] as const;
export type PlanKey = (typeof PLAN_ORDER)[number];

/** A consumer's full identity: one rung on each axis. */
export type ClassIdentity = { cls: ClassKey; plan: PlanKey };

// ── The bridge ─────────────────────────────────────────────────────────────
//
// Leftover-key bridge. The DB stores metals on consumers.class_key and
// free|premium on consumers.plan. Frozen mobile and older payloads still
// speak standard/influencer/premium/aura; this map (mirrored in
// promos-v11-normalize.ts) is the one definition both sides read.
export const LEGACY_CLASS_KEYS = [
  "standard",
  "influencer",
  "premium",
  "aura",
] as const;
export type LegacyClassKey = (typeof LEGACY_CLASS_KEYS)[number];

export const LEGACY_CLASS_IDENTITY: Record<LegacyClassKey, ClassIdentity> = {
  standard: { cls: "bronze", plan: "free" },
  influencer: { cls: "silver", plan: "free" },
  premium: { cls: "bronze", plan: "premium" },
  aura: { cls: "diamond", plan: "free" },
};

/**
 * Resolve a stored `consumers.class_key` onto the two v2 axes.
 *
 * Metals pass through. Leftover legacy keys still map. `plan` from
 * `consumers.plan` wins when provided.
 */
export function identityForClassKey(
  key: string | null | undefined,
  plan?: PlanKey | null,
): ClassIdentity {
  const planArg = plan === "premium" || plan === "free" ? plan : null;
  if (key && (CLASS_ORDER as readonly string[]).includes(key)) {
    return { cls: key as ClassKey, plan: planArg ?? "free" };
  }
  const hit = (LEGACY_CLASS_KEYS as readonly string[]).includes(key ?? "")
    ? LEGACY_CLASS_IDENTITY[key as LegacyClassKey]
    : undefined;
  if (hit) return { cls: hit.cls, plan: planArg ?? hit.plan };
  return { cls: "bronze", plan: planArg ?? "free" };
}

// Elevated = off the floor on EITHER axis — a class above the floor, or the
// Premium plan. Both unlock the same perk set (better recommendations, 10
// reservations a month), which is exactly why one predicate spans two axes
// instead of each surface re-deriving the union.
//
// The floor is CLASS_FLOOR.id, not the string "bronze". This predicate is the
// gate every elevated perk reads, so a hardcoded metal here would outrank the
// ladder itself: re-seat the floor and the perk would keep unlocking off a
// rung that no longer sits at the bottom.
export function isElevatedIdentity({ cls, plan }: ClassIdentity): boolean {
  return cls !== CLASS_FLOOR.id || plan === "premium";
}

// NOTE: The original Lovable export shipped a large local `Place` type
// (with fields for popular-times bars, visitor avatars, etc.). Discover
// surfaces now consume `Place` from `@/lib/api/places` — the EF-backed
// shape — and the rich detail surface reads `PlaceDetail` from
// `@/lib/mock/place`. This module no longer carries a Place type.

// Country list — used by the phone-input dial-code picker (the residence
// dropdown was retired; country is inferred from the phone's dial code).
// Ordered roughly by hospitality relevance:
// Mexico first (the home market), Latam + Iberian world next, then a
// short tail of common origin countries. `dial` is the E.164 country
// calling code (no leading "+"); the picker re-adds the plus visually.
export type Country = {
  code: string;
  name: string;
  flag: string;
  dial: string;
};
export const COUNTRIES: Country[] = [
  { code: "MX", name: "Mexico", flag: "🇲🇽", dial: "52" },
  { code: "US", name: "United States", flag: "🇺🇸", dial: "1" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dial: "1" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dial: "34" },
  // LatAm core — Mesita's natural expansion path.
  { code: "AR", name: "Argentina", flag: "🇦🇷", dial: "54" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", dial: "57" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dial: "56" },
  { code: "PE", name: "Peru", flag: "🇵🇪", dial: "51" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dial: "55" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", dial: "598" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", dial: "595" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", dial: "591" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", dial: "593" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dial: "58" },
  // Central America + Caribbean — second-wave markets.
  { code: "GT", name: "Guatemala", flag: "🇬🇹", dial: "502" },
  { code: "HN", name: "Honduras", flag: "🇭🇳", dial: "504" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", dial: "503" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", dial: "505" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", dial: "506" },
  { code: "PA", name: "Panama", flag: "🇵🇦", dial: "507" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴", dial: "1" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷", dial: "1" },
  // Common visitor origins.
  { code: "UK", name: "United Kingdom", flag: "🇬🇧", dial: "44" },
  { code: "FR", name: "France", flag: "🇫🇷", dial: "33" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dial: "39" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dial: "49" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dial: "31" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dial: "351" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dial: "81" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dial: "61" },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

export const CLASSES: {
  id: ClassKey;
  label: string;
  /** The rung's unlock line. On reach rungs it names BOTH doors — followers
   *  and Invitation — because an invitation can grant ANY class outright
   *  (MESITA-1126), so every bar the ladder quotes has a manual twin. Keeps
   *  the rows symmetric with the two buttons under the ladder — "Join with
   *  Instagram" / "Join with Invitation" (decision: Pato, 2026-08-22). */
  req: string;
  /** Follower threshold via Instagram verification. 0 = not a reach door. */
  followerThreshold: number;
  reward: string;
}[] = [
  // The class IS the brand — rendered as "Mesita Bronze" / "Mesita Diamond" in
  // marketing and Passport surfaces. The compact `label` here is used inside
  // tight UI (class badges, table rows) where the "Mesita" prefix is noise.
  //
  // NO `priceMxn` ON A CLASS, on purpose: under v2 a class is never
  // purchasable. Money lives on PLANS below, and nowhere else.
  //
  // AND NO `perk` (decision: Pato, MESITA-1123). A class moves ONE thing: the
  // discount rate, which is what `reward` names. It does not grant better
  // recommendations, reservation quota, or anything else — those ride the PLAN.
  // The old `perk` field claimed "Better recs · 10 reservations" on three rows
  // and was read by nothing, so it was wrong AND dead. Do not re-add a second
  // benefit field here; if a class ever confers more, that is a product
  // decision, not a data-shape one.
  {
    id: "bronze",
    label: "Bronze",
    req: "Every account starts here",
    followerThreshold: 0,
    reward: "Base discount",
  },
  {
    id: "silver",
    label: "Silver",
    req: "1,000+ followers · Invitation",
    // Mirrors classes.follower_threshold in the DB — the EF grants off that
    // row (generic: highest-ranked row the count clears), so this constant is
    // DISPLAY-ONLY and must track it. Changing it here without the migration
    // makes the ladder quote a bar the grant engine doesn't honour.
    // Story Bonus is separate (MESITA-909): any connected Instagram unlocks
    // it, not just a reach class.
    followerThreshold: 1_000,
    reward: "Higher discount",
  },
  {
    id: "gold",
    label: "Gold",
    // STILL UNGRANTABLE (MESITA-1076). The bar is real — Pato set it at 5,000
    // — but `classes` has no gold row: `rank` is UNIQUE and rank 2 is held by
    // the legacy `premium` row, so seating Gold between Silver and Diamond
    // means re-ranking the live table and moving every consumer's effective
    // class. Until that migration lands the ladder shows this bar and nothing
    // clears it; a 5,000-follower account stays Silver.
    req: "5,000+ followers · Invitation",
    followerThreshold: 5_000,
    reward: "Higher discount",
  },
  {
    id: "diamond",
    label: "Diamond",
    req: "20,000+ followers · Invitation",
    followerThreshold: 20_000,
    // Highest flat class rate — the house pays for presence, no posting asked.
    reward: "Highest discount",
  },
];

// The OTHER axis. Premium is a subscription, not a rung: it never appears in
// CLASSES and stays invisible to places. It DOES render on the guest's own
// Passport, in its own Plan tile — separate from Class, never merged into it.
export const PLANS: {
  id: PlanKey;
  label: string;
  req: string;
  priceMxn: number;
}[] = [
  { id: "free", label: "Free", req: "Default account", priceMxn: 0 },
  { id: "premium", label: "Premium", req: "$50 MXN / mo", priceMxn: 50 },
];

export const PREMIUM_PLAN_PRICE_MXN = PLANS.find((p) => p.id === "premium")!
  .priceMxn;

// The floor — the rung an account is on before it clears anything, found by
// SHAPE (the one rung with no follower bar) rather than by naming a metal.
// Bronze holds it today. Symmetric with REACH_ENTRY_CLASS below: one is the
// rung you start on, the other the first you can climb to, and neither is
// spelled out anywhere else. `find` takes the first match in ladder order, so
// even a malformed ladder with two barless rungs resolves to the lower one.
export const CLASS_FLOOR =
  CLASSES.find((c) => c.followerThreshold === 0) ?? CLASSES[0];

// The reach entry rung — the lowest class a follower count can open, found by
// SHAPE (cheapest non-zero bar on the ladder) rather than by naming a metal.
// Silver holds it today; if the ladder is re-ranked, re-priced, or renamed,
// this follows without an edit, and copy that quotes the bar keeps quoting the
// rung that bar actually grants. Its threshold mirrors
// classes.follower_threshold in the DB — the gate
// consumer-web-claim-instagram grants off. Story Bonus is gated on a connected
// handle (MESITA-909), not this threshold.
export const REACH_ENTRY_CLASS = CLASSES.filter(
  (c) => c.followerThreshold > 0,
).reduce((lowest, c) =>
  c.followerThreshold < lowest.followerThreshold ? c : lowest,
);

/** Every surface quoting or applying the bar derives from this one constant. */
export const REACH_ENTRY_FOLLOWERS = REACH_ENTRY_CLASS.followerThreshold;

// Canonical class icon set: one mark + one color per class, ascending as a
// single readable progression — Medal → Award → Trophy → Gem. The v1 set
// (Smile / Megaphone / CreditCard / Crown) named the old classes rather than a
// ladder, and two of its marks were about the DOOR (a megaphone for reach, a
// card for money) rather than the rung. CreditCard survives on PLAN_ICON,
// which is the axis money actually belongs to.
export const CLASS_ICONS: Record<ClassKey, LucideIcon> = {
  bronze: Medal,
  silver: Award,
  gold: Trophy,
  diamond: Gem,
};

/** The plan axis has one mark — Free is the absence of it, not a badge. */
export const PREMIUM_PLAN_ICON: LucideIcon = CreditCard;

/** Sheet / section mark for the Classes surface (not a membership class). */
export const CLASS_MARK_ICON: LucideIcon = Pyramid;

// Canonical bg + text class per class. Used wherever a class needs the
// brand-color chip treatment (avatars, pills, hero rows). Compose with
// cn() at the call site when extra modifiers (size, rounding) are needed.
// FILL AND INK TRAVEL TOGETHER, always, and this is the only place that pairs
// them. Callers that took a fill from a separate map and hardcoded `text-white`
// beside it are what let three surfaces print white on a light metal — Silver
// was caught early and given foreground ink here, but the note that did it
// ("white-on-silver fails contrast") never asked whether any OTHER rung was
// also a light fill. Two were: white measured 1.53:1 on gold and 1.44:1 on
// diamond (MESITA-1142). Bronze, the floor, is the only metal dark enough to
// carry white.
export function classBadgeClass(classKey: ClassKey): string {
  switch (classKey) {
    case "bronze":
      return "bg-tier-bronze text-white";
    case "silver":
      return "bg-tier-silver text-foreground";
    case "gold":
      return "bg-tier-gold text-foreground";
    case "diamond":
      return "bg-tier-diamond text-foreground";
  }
}

// Compact Title-Case label per class. Used by the swipe overlay, the
// promo chip and the place detail rewards box — anywhere we render "Mesita Standard" / "Mesita Premium" /
// "Mesita Influencer" / "Mesita Aura" alongside the lower-case class id.
//
// Accepts a strictly-typed ClassKey or a plain string so callers can hand us
// either (e.g. a server-sourced class_key that flows as string) without an
// extra cast; unknown values fall back to the "Mesita" brand word.
const CLASS_LABELS: Record<ClassKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

export function classProperLabel(classKey: ClassKey | string): string {
  return CLASS_LABELS[classKey as ClassKey] ?? "Mesita";
}

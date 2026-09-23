import { CreditCard, Gem, Store, type LucideIcon } from "lucide-react";

import { DIAMOND_LIST } from "@/lib/consumer-identity";

// ── The Diamond List (MESITA-2044; was Classes v2, MESITA-1039/-1079) ──────
//
// TWO INDEPENDENT AXES, and the entire point is that they never merge:
//
//   list  — WHO YOU ARE. On the Diamond List or not, nothing in between
//           (Pato, MESITA-2044). Invitation is the only way on; followers
//           grant nothing. Stored as `consumers.class_key` = `bronze` (not on
//           the list) or `diamond` (on it) — STORAGE KEYS, never read aloud.
//           Silver and Gold are gone: a stray `silver`/`gold` row resolves to
//           `bronze` below, i.e. "not on the list".
//   plan  — WHAT YOU PAY. Free or Premium (MX$50/mo). Private from the
//           BUSINESS side: a place never learns it. Private from the guest's
//           own Passport too (MESITA-1619) — the identity card prints what is
//           EARNED, so the plan reads in its own box on Me and nowhere on the
//           passport. The two axes never MERGE: no class is purchasable and
//           no plan is a metal, which is the whole reason `plan` is a
//           separate type rather than a fifth class.
//
// The retired v1 ladder was standard < influencer < premium < aura, which put
// the paid subscription INSIDE the class ladder — "Premium" ranked above
// "Influencer" as if money were reach. That merge is what this replaces, and
// it is why `plan` is a separate type rather than a fifth class.
export const CLASS_ORDER = ["bronze", "diamond"] as const;
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
// promos-normalize.ts) is the one definition both sides read.
//
// NOTE the asymmetry since MESITA-1705: the EF's copy resolves the CLASS only,
// because the plan stopped pricing rewards. This one still carries `plan`,
// because the consumer app reads it for PERKS (reservation caps, better
// recommendations) — which Premium still buys.
export const LEGACY_CLASS_KEYS = [
  "standard",
  "influencer",
  "premium",
  "aura",
] as const;
export type LegacyClassKey = (typeof LEGACY_CLASS_KEYS)[number];

export const LEGACY_CLASS_IDENTITY: Record<LegacyClassKey, ClassIdentity> = {
  standard: { cls: "bronze", plan: "free" },
  // Was Silver, which no longer exists: reach grants nothing (MESITA-2044).
  influencer: { cls: "bronze", plan: "free" },
  premium: { cls: "bronze", plan: "premium" },
  aura: { cls: "diamond", plan: "free" },
};

/**
 * Resolve a stored `consumers.class_key` onto the two v2 axes.
 *
 * `bronze`/`diamond` pass through. Leftover legacy keys still map. Anything
 * else — including a stray `silver`/`gold` row — is "not on the list".
 * `plan` from `consumers.plan` wins when provided.
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

// Elevated = off the floor on EITHER axis — on the Diamond List, or the
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
  /** ISO 3166-1 alpha-3. The MRZ nationality field is three characters wide
   *  (MESITA-1820) and a padded two-letter code would be a lie, not a pad.
   *  `UK` above is the row's LOCAL key, kept for back-compat with stored
   *  values; its real alpha-3 is GBR. Keep this list and the mobile copy at
   *  `apps/mobile-consumer/src/lib/countries.ts` in the same order so a
   *  future diff reads. */
  iso3: string;
};
export const COUNTRIES: Country[] = [
  { code: "MX", name: "Mexico", flag: "🇲🇽", dial: "52", iso3: "MEX" },
  { code: "US", name: "United States", flag: "🇺🇸", dial: "1", iso3: "USA" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dial: "1", iso3: "CAN" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dial: "34", iso3: "ESP" },
  // LatAm core — Mesita's natural expansion path.
  { code: "AR", name: "Argentina", flag: "🇦🇷", dial: "54", iso3: "ARG" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", dial: "57", iso3: "COL" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dial: "56", iso3: "CHL" },
  { code: "PE", name: "Peru", flag: "🇵🇪", dial: "51", iso3: "PER" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dial: "55", iso3: "BRA" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", dial: "598", iso3: "URY" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", dial: "595", iso3: "PRY" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", dial: "591", iso3: "BOL" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", dial: "593", iso3: "ECU" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dial: "58", iso3: "VEN" },
  // Central America + Caribbean — second-wave markets.
  { code: "GT", name: "Guatemala", flag: "🇬🇹", dial: "502", iso3: "GTM" },
  { code: "HN", name: "Honduras", flag: "🇭🇳", dial: "504", iso3: "HND" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", dial: "503", iso3: "SLV" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", dial: "505", iso3: "NIC" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", dial: "506", iso3: "CRI" },
  { code: "PA", name: "Panama", flag: "🇵🇦", dial: "507", iso3: "PAN" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴", dial: "1", iso3: "DOM" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷", dial: "1", iso3: "PRI" },
  // Common visitor origins.
  { code: "UK", name: "United Kingdom", flag: "🇬🇧", dial: "44", iso3: "GBR" },
  { code: "FR", name: "France", flag: "🇫🇷", dial: "33", iso3: "FRA" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dial: "39", iso3: "ITA" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dial: "49", iso3: "DEU" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dial: "31", iso3: "NLD" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dial: "351", iso3: "PRT" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dial: "81", iso3: "JPN" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dial: "61", iso3: "AUS" },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

// The two identity rows every rate surface prints (MESITA-2044). `label` is
// what a guest reads — "Base" and "Diamond List", never a metal.
//
// NO `priceMxn` and NO `perk`, on purpose: the list is never purchasable and
// it moves ONE thing, the discount rate (decision: Pato, MESITA-1123).
export const CLASSES: {
  id: ClassKey;
  label: string;
  /** How a guest lands on this row. */
  req: string;
  reward: string;
}[] = [
  {
    id: "bronze",
    label: "Base",
    req: "Every guest, every visit",
    reward: "Base discount",
  },
  {
    id: "diamond",
    label: DIAMOND_LIST,
    req: "Invitation only",
    reward: "More on top of the base",
  },
];

// The OTHER axis. Premium is a subscription, not a rung: it never appears in
// CLASSES and stays invisible to places — and, since MESITA-1619, it does not
// print on the guest's own Passport either. It renders in Me › Plan, separate
// from Class and never merged into it.
export const PLANS: {
  id: PlanKey;
  label: string;
  req: string;
  priceMxn: number;
}[] = [
  { id: "free", label: "Free", req: "Default account", priceMxn: 0 },
  { id: "premium", label: "Premium", req: "$50 MXN / mo", priceMxn: 50 },
];

export const PREMIUM_PLAN_PRICE_MXN = PLANS.find(
  (p) => p.id === "premium",
)!.priceMxn;

// The floor — where every account is before an invitation. `REACH_ENTRY_CLASS`
// and `REACH_ENTRY_FOLLOWERS` lived beside it and are gone (MESITA-2044):
// followers open nothing on this axis any more, so there is no entry rung to
// derive. The Instagram bar is `INSTAGRAM_REACH_FOLLOWERS` in
// consumer-identity.ts.
export const CLASS_FLOOR = CLASSES[0];

// `passportDoorCaptions` LIVED HERE AND IS GONE (MESITA-1819 -> MESITA-2040).
// It produced the two captions on Me › Passport's door tiles, and its whole
// job was keeping a PERK (the class's discount) from being glued to a DOOR
// (how to climb) with a middle dot — Diamond once read "Highest discount ·
// Instagram or an invite", telling a ceiling guest how to reach the rung they
// already held. The four states it switched on were (floor | mid | ceiling) ×
// (connected | not), which only exist on a ladder. The captions are one line
// per fact now, in `consumer-identity.ts`; do not reintroduce a helper here
// that takes both facts at once, because that is the shape that lets one
// caption talk about the other fact.

// One mark per identity row: the Base is the place's standing offer (Store),
// the Diamond List is the gem. The Medal → Award → Trophy → Gem progression
// drew a ladder, and there is no ladder (MESITA-2044).
export const CLASS_ICONS: Record<ClassKey, LucideIcon> = {
  bronze: Store,
  diamond: Gem,
};

/** The plan axis has one mark — Free is the absence of it, not a badge. */
export const PREMIUM_PLAN_ICON: LucideIcon = CreditCard;

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
// carry white. Silver and Gold left with the ladder (MESITA-2044); their CSS
// tokens are orphaned, not load-bearing.
export function classBadgeClass(classKey: ClassKey): string {
  switch (classKey) {
    case "bronze":
      return "bg-tier-bronze text-white";
    case "diamond":
      return "bg-tier-diamond text-foreground";
  }
}

/** The bare metal, with NO ink paired to it — for surfaces where nothing sits
 *  on top of the fill: the identity header's band, the avatar ring. Anything that
 *  prints a label on the metal takes `classBadgeClass` instead, which is the
 *  only place fill and ink are paired (see the note above it). */
export function classFillClass(classKey: ClassKey): string {
  switch (classKey) {
    case "bronze":
      return "bg-tier-bronze";
    case "diamond":
      return "bg-tier-diamond";
  }
}

/** A soft wash of the metal behind a surface — not a fill, not text ink.
 *  Mirrors classFillClass exactly so the wash stays parametric per class
 *  (MESITA-1688): the identity header spends more of MESITA-1132's
 *  colour budget by letting the metal bleed across the header/card
 *  background, without adding a third hard-edged fill surface. */
export function classWashClass(classKey: ClassKey): string {
  switch (classKey) {
    case "bronze":
      return "wash-bronze";
    case "diamond":
      return "wash-diamond";
  }
}

// `classProperLabel` and its four-metal CLASS_LABELS map LIVED HERE and are
// gone (MESITA-2044). They printed "Bronze"/"Silver"/"Gold"/"Diamond" on the
// ticket pass, the rate sheet and the social cards. A surface that names the
// guest's standing now prints `DIAMOND_LIST` (consumer-identity.ts) when they
// are on the list and nothing when they are not.

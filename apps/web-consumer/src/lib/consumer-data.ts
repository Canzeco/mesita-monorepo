import {
  CreditCard,
  Crown,
  Megaphone,
  Pyramid,
  Smile,
  type LucideIcon,
} from "lucide-react";

// Ascending class ladder (segments v6, canonical order MESITA-972): standard
// (default) < influencer (Instagram ≥ 2,000 followers, automatic) < premium
// (paid) < aura (invite-only presence class) — mirrors classes.rank in the DB
// and the money ladder (class steps +5 influencer / +10 premium / +15 aura).
// "class" is the consumer membership axis — distinct from a business's
// billing "plan" (free/pro/ultra).
export const CLASS_ORDER = [
  "standard",
  "influencer",
  "premium",
  "aura",
] as const;
export type ClassKey = (typeof CLASS_ORDER)[number];

// Premium-perk gate: everything above Standard unlocks the same elevated perk
// set — better recommendations, higher discount rewards, 10 reservations a
// month. Generic on purpose: a future class joins the ladder by joining
// CLASS_ORDER, never by another branch here.
export function isElevatedClass(classKey: ClassKey | string): boolean {
  return (
    classKey !== "standard" &&
    (CLASS_ORDER as readonly string[]).includes(classKey)
  );
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
  req: string;
  /** Monthly subscription price in MXN. 0 for Standard (the default),
   *  Influencer (earned with Instagram reach), and Aura (invited). Premium
   *  is granted upfront on payment — no spend accumulation required. */
  priceMxn: number;
  /** Follower threshold via Instagram verification. 0 = no threshold. */
  followerThreshold: number;
  reward: string;
  perk: string;
}[] = [
  // The class IS the brand — rendered as "Mesita Standard" / "Mesita Premium" /
  // "Mesita Influencer" / "Mesita Aura" in marketing and subscribe surfaces.
  // The compact `label` here is used inside tight UI (class badges, table
  // rows) where the "Mesita" prefix is noise.
  {
    id: "standard",
    label: "Standard",
    req: "Default account",
    priceMxn: 0,
    followerThreshold: 0,
    reward: "Base discount",
    perk: "Welcome to the club",
  },
  {
    id: "influencer",
    label: "Influencer",
    req: "2,000+ IG followers",
    priceMxn: 0,
    // Mirrors classes.follower_threshold in the DB — the EF grants off that
    // row, so this constant is display-only and must track it.
    followerThreshold: 2_000,
    // Class identity = reach door. Story Bonus is separate (MESITA-909):
    // any connected Instagram unlocks it, not just Influencer.
    reward: "HIGH discount · Story when connected",
    perk: "Better recs · 10 reservations",
  },
  {
    id: "premium",
    label: "Premium",
    req: "$100 MXN / mo",
    priceMxn: 100,
    followerThreshold: 0,
    reward: "Higher discount",
    perk: "Better recs · 10 reservations",
  },
  {
    id: "aura",
    label: "Aura",
    req: "By invitation only",
    priceMxn: 0,
    followerThreshold: 0,
    // Highest flat class rate — paid for presence, no posting required.
    reward: "Highest base discount",
    perk: "Better recs · 10 reservations",
  },
];

// The Influencer follower bar — mirrors classes.follower_threshold in the DB
// (the gate consumer-web-claim-instagram grants off). Every surface quoting
// or applying the bar derives from this one constant. Story Bonus is gated
// on a connected handle (MESITA-909), not this threshold.
export const INFLUENCER_FOLLOWER_THRESHOLD = CLASSES.find(
  (c) => c.id === "influencer",
)!.followerThreshold;

// Canonical class icon set (MESITA-929): one mark + one color per class.
// Standard = smile (gray), Influencer = megaphone (red), Premium = card
// (blue), Aura = crown (yellow/gold). The Classes sheet mark is the pyramid.
export const CLASS_ICONS: Record<ClassKey, LucideIcon> = {
  standard: Smile,
  premium: CreditCard,
  influencer: Megaphone,
  aura: Crown,
};

/** Sheet / section mark for the Classes surface (not a membership class). */
export const CLASS_MARK_ICON: LucideIcon = Pyramid;

// Canonical bg + text class per class. Used wherever a class needs the
// brand-color chip treatment (avatars, pills, hero rows). Compose with
// cn() at the call site when extra modifiers (size, rounding) are needed.
export function classBadgeClass(classKey: ClassKey): string {
  switch (classKey) {
    case "standard":
      return "bg-tier-free text-foreground";
    case "premium":
      return "bg-tier-premium text-white";
    case "influencer":
      return "bg-tier-influencer text-white";
    case "aura":
      return "bg-tier-gold text-white";
  }
}

// Compact Title-Case label per class. Used by the swipe overlay, the
// promo chip, the coupon promo card, and the place detail rewards
// box — anywhere we render "Mesita Standard" / "Mesita Premium" /
// "Mesita Influencer" / "Mesita Aura" alongside the lower-case class id.
//
// Accepts a strictly-typed ClassKey or a plain string so callers can hand us
// either (e.g. a server-sourced class_key that flows as string) without an
// extra cast; unknown values fall back to the "Mesita" brand word.
const CLASS_LABELS: Record<ClassKey, string> = {
  standard: "Standard",
  premium: "Premium",
  influencer: "Influencer",
  aura: "Aura",
};

export function classProperLabel(classKey: ClassKey | string): string {
  return CLASS_LABELS[classKey as ClassKey] ?? "Mesita";
}

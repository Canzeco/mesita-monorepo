import type { PlacePlan } from "@/lib/api/places";

// Subscription catalog used by place summaries (label lookup).
//
// Promos v4 (MESITA-541), ratified 2026-08-21 (MESITA-1154): a place is
// either Free or holds the Partnership subscription (MX$1,000 + IVA/year).
// Verified is a
// SEPARATE, free ownership fact (resolvePlaceVerification in place-utils.ts)
// — never this catalog's label. Discount Strategies (Zero / Conservative /
// Aggressive) live on the Promos page and are NOT separate Stripe products —
// paid Strategies all grant the same Partnership (`plan=pro`). Legacy `ultra`
// folds onto it for display. Never sell organic ranking: the bundle is
// named explicitly, not "algorithm placement".

/** Catalog id — Free or the single Membership (Partner state). */
type SubscriptionId = "free" | "partner";

type SubscriptionRow = {
  id: SubscriptionId;
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  setup?: string;
  featured?: boolean;
};

export const SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: "free",
    label: "Listed",
    price: "MX$0",
    cadence: "/ month",
    tagline: "Listed on Mesita.",
  },
  {
    id: "partner",
    label: "Partnership",
    price: "MX$1,000 + IVA",
    cadence: "/ year",
    tagline: "Partnership, guest rewards, Performance, Reservationist.",
    setup: "WhatsApp ping + first ticket",
    featured: true,
  },
];

/** True when the place holds the Partnership subscription (any paid plan key). */
function isPartner(p: PlacePlan): boolean {
  return p !== "free";
}

export function subscriptionForPlace(p: PlacePlan): SubscriptionId {
  return isPartner(p) ? "partner" : "free";
}

// Ported with MESITA-1537 (the Place screen mounts admin's Single Place
// components). `plan` is billing, not profile: it reaches the DB through the
// paid door only — business-web-update-place rejects any body carrying it.
/** The LEGACY strategy ids the ported Controls components still speak.
 *  Distinct from this file's own SubscriptionId (free | partner), which is
 *  the live catalog. */
type StrategySubscriptionId = "free" | "pro_discount" | "ultra_discount";

/** The `membership` enum value a strategy maps to. */
export type PlanKey = "free" | "pro" | "ultra";

export function planForSubscription(sub: StrategySubscriptionId): PlanKey {
  if (sub === "pro_discount") return "pro";
  if (sub === "ultra_discount") return "ultra";
  return "free";
}

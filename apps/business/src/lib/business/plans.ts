import type { FiscalType, PlacePlan } from "@/lib/api/places";

// Subscription catalog used by Promos (picker + label lookup).
//
// Three subscriptions, ordered ascending so the business reads the picker
// left-to-right as a visibility ladder:
//   - "Free without promos" (plan=free)                            · Low    · $0
//   - "Pro"                  (plan=informal_pro,   fiscal=informal) · Medium · $200/yr
//   - "Ultra"                (plan=informal_ultra, fiscal=informal) · Max    · $5,000/mo
//
// Mesita is discounts-only: every Verified place runs the same instant
// discount applied directly at the bill, with no money flowing through
// Mesita. Pro vs Ultra only changes price and visibility tier; the promo
// workflow is identical. Cashback / Mesita-in-the-loop "reward" tiers are
// deliberately deferred (see Notion → Main → Future Expansions) and are not
// offered in the console.

export type PlanVisibility = "Low" | "Medium" | "Max";

// Picker id — one per card.
export type SubscriptionId = "free" | "pro_discount" | "ultra_discount";

type SubscriptionRow = {
  id: SubscriptionId;
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  visibility: PlanVisibility;
  // Rough setup time the business should expect. Discount is just a coupon
  // workflow (no integration); the formal Reward flow requires connecting a
  // business so Mesita can settle the payment.
  setup?: string;
  featured?: boolean;
};

export const SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: "free",
    label: "Free without promos",
    price: "MX$0",
    cadence: "/ month",
    tagline: "Listed on Mesita.",
    visibility: "Low",
  },
  {
    id: "pro_discount",
    label: "Pro",
    price: "MX$200",
    cadence: "/ year",
    tagline: "Consumer shows the coupon, you discount the bill.",
    visibility: "Medium",
    setup: "1 min",
  },
  {
    id: "ultra_discount",
    label: "Ultra",
    price: "MX$5,000",
    cadence: "/ month",
    tagline: "Same coupon flow, maximum visibility.",
    visibility: "Max",
    setup: "1 min",
    featured: true,
  },
];

// Legacy formal_* (reward/cashback) plans are no longer offered, but the DB
// enum still allows them, so keep these mappings total. They fold onto their
// informal discount counterpart for display.
export function visibilityForPlan(p: PlacePlan): PlanVisibility {
  if (p === "free") return "Low";
  if (p === "informal_pro" || p === "formal_pro") return "Medium";
  return "Max"; // informal_ultra / formal_ultra
}

export function subscriptionForPlace(p: PlacePlan): SubscriptionId {
  if (p === "free") return "free";
  if (p === "informal_pro" || p === "formal_pro") return "pro_discount";
  return "ultra_discount"; // informal_ultra / formal_ultra
}

// Atomic write payload for the picker — one card click sets both plan
// and fiscal_type in a single apiUpdatePlace call. Discounts run on the
// informal (off-rail) fiscal type.
export function dbStateForSubscription(sub: SubscriptionId): {
  plan: PlacePlan;
  fiscal_type?: FiscalType;
} {
  if (sub === "free") return { plan: "free" };
  if (sub === "pro_discount")
    return { plan: "informal_pro", fiscal_type: "informal" };
  return { plan: "informal_ultra", fiscal_type: "informal" }; // ultra_discount
}

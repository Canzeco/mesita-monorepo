import type { PlacePlan } from "@/lib/api/places";

// Subscription catalog used by Promos (picker + label lookup).
//
// Three subscriptions, ordered ascending so the business reads the picker
// left-to-right as a visibility ladder:
//   - "Free without promos" (plan=free)  · Low    · $0
//   - "Promote"             (plan=pro)   · Medium · $100/mo
//   - "Ultra"               (plan=ultra) · Max    · $5,000/mo
//
// Paid plans are monthly Stripe subscriptions: picking a card goes through
// business-change-subscription (Stripe Checkout), never a direct plan write.
//
// Mesita is discounts-only: every Verified place runs the same instant
// discount applied directly at the bill, with no money flowing through
// Mesita. Promote vs Ultra only changes price and visibility tier; the promo
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
    label: "Promote",
    price: "MX$100",
    cadence: "/ month",
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

export function visibilityForPlan(p: PlacePlan): PlanVisibility {
  if (p === "free") return "Low";
  if (p === "pro") return "Medium";
  return "Max"; // ultra
}

export function subscriptionForPlace(p: PlacePlan): SubscriptionId {
  if (p === "free") return "free";
  if (p === "pro") return "pro_discount";
  return "ultra_discount"; // ultra
}

// Plan key the billing EF expects for a picker card.
export function planForSubscription(sub: SubscriptionId): PlacePlan {
  if (sub === "free") return "free";
  if (sub === "pro_discount") return "pro";
  return "ultra"; // ultra_discount
}

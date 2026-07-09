// Subscription catalog for admin Promos (picker + visibility ladder).
// Ported from mesita-web-business-legacy / mesita-web-business.
//
// Three subscriptions, ordered ascending as a visibility ladder:
//   - Free  (plan=free)                              · Low
//   - Pro   (plan=informal_pro, fiscal=informal)     · Medium
//   - Ultra (plan=informal_ultra, fiscal=informal)   · Max
//
// Admin writes plan directly (no Stripe Checkout). Legacy formal_* rows
// still exist in the DB enum — fold them onto the matching discount tier.

export type PlanVisibility = "Low" | "Medium" | "Max";

export type SubscriptionId = "free" | "pro_discount" | "ultra_discount";

export type PlacePlan =
  | "free"
  | "pro"
  | "ultra"
  | "informal_pro"
  | "informal_ultra"
  | "formal_pro"
  | "formal_ultra"
  | string
  | null;

type SubscriptionRow = {
  id: SubscriptionId;
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  visibility: PlanVisibility;
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
  if (!p || p === "free") return "Low";
  if (p === "pro" || p === "informal_pro" || p === "formal_pro") return "Medium";
  return "Max";
}

export function subscriptionForPlan(p: PlacePlan): SubscriptionId {
  if (!p || p === "free") return "free";
  if (p === "pro" || p === "informal_pro" || p === "formal_pro") return "pro_discount";
  return "ultra_discount";
}

/** Atomic write payload for the plan picker — admin bypasses Stripe. */
export function dbStateForSubscription(sub: SubscriptionId): {
  plan: string;
  fiscal_type?: string;
} {
  if (sub === "pro_discount") return { plan: "informal_pro", fiscal_type: "informal" };
  if (sub === "ultra_discount") return { plan: "informal_ultra", fiscal_type: "informal" };
  return { plan: "free" };
}

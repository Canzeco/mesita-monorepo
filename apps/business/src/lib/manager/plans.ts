import type { VenuePlan } from "@/lib/api/venues";
import type { FiscalType } from "@/components/shared";

// Subscription catalog used by Promos (picker + label lookup).
//
// Three subscriptions, one per DB enum value, ordered ascending so the
// manager reads the picker left-to-right as a ladder:
//   - "Free without promos"  (plan=free)                          · Minimum  · $0
//   - "Pro with Discounts"   (plan=informal_pro, fiscal=informal) · Priority · $500
//   - "Pro with Cashbacks"   (plan=formal_pro,   fiscal=formal)   · Maximum  · $1000
//
// Pro with Cashbacks costs 2× Pro with Discounts because it captures the
// wallet flow — Mesita runs the payment, returns part to the guest's
// wallet, and the venue lands on Maximum visibility. Pro with Discounts
// is the lower-commitment tier: same promo tooling, Priority visibility,
// but Mesita is not in the payment loop.

export type PlanMechanic = "None" | "Cashback" | "Discount";
export type PlanVisibility = "Minimum" | "Priority" | "Maximum";

// Picker id — one per card.
export type SubscriptionId = "free" | "cashback" | "discount";

export type SubscriptionRow = {
  id: SubscriptionId;
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  visibility: PlanVisibility;
  // Rough setup time the manager should expect. Discount is just a coupon
  // workflow (no integration); Cashback requires connecting a business so
  // Mesita can settle the payment.
  setup?: string;
  featured?: boolean;
};

export const SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: "free",
    label: "Free without promos",
    price: "$0",
    cadence: "MX / year",
    tagline: "Listed on Mesita.",
    visibility: "Minimum",
  },
  {
    id: "discount",
    label: "Pro with Discounts",
    price: "$500",
    cadence: "MX / year",
    tagline: "Guest shows the coupon, you discount the bill.",
    visibility: "Priority",
    setup: "1 min",
  },
  {
    id: "cashback",
    label: "Pro with Cashbacks",
    price: "$1,000",
    cadence: "MX / year",
    tagline: "Card runs through Mesita, returned to the guest's wallet.",
    visibility: "Maximum",
    setup: "10 min · connect business",
    featured: true,
  },
];

// Mechanic still rides on the venue's fiscal_type — Formal venues issue
// cashback through the wallet, Informal venues apply discounts at the
// bill.
export function mechanicForFiscal(fiscal: FiscalType): "Cashback" | "Discount" {
  return fiscal === "formal" ? "Cashback" : "Discount";
}

export function mechanicForPlan(p: VenuePlan): PlanMechanic {
  if (p === "free") return "None";
  if (p === "formal_pro") return "Cashback";
  return "Discount";
}

export function visibilityForPlan(p: VenuePlan): PlanVisibility {
  if (p === "free") return "Minimum";
  if (p === "informal_pro") return "Priority";
  return "Maximum";
}

export function subscriptionForVenue(p: VenuePlan): SubscriptionId {
  if (p === "free") return "free";
  if (p === "formal_pro") return "cashback";
  return "discount";
}

// Atomic write payload for the picker — one card click sets both plan
// and fiscal_type in a single apiUpdateVenue call.
export function dbStateForSubscription(
  sub: SubscriptionId,
): { plan: VenuePlan; fiscal_type?: FiscalType } {
  if (sub === "free") return { plan: "free" };
  if (sub === "cashback") return { plan: "formal_pro", fiscal_type: "formal" };
  return { plan: "informal_pro", fiscal_type: "informal" };
}

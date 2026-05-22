import type { VenuePlan } from "@/lib/api/venues";
import type { FiscalType } from "@/components/shared";

// Subscription catalog used by Promos (picker + label lookup).
//
// Three subscriptions, one per DB enum value:
//   - Free      (plan=free)              · Minimum visibility
//   - Cashback  (plan=formal_pro,   fiscal=formal)   · Maximum visibility
//   - Discount  (plan=informal_pro, fiscal=informal) · Priority visibility
//
// Cashback and Discount cost the same; the difference is operational
// (does the venue settle through Mesita?). Visibility ladders by
// mechanic — Cashback gets Maximum because Mesita captures the wallet
// flow, Discount caps at Priority.

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
  featured?: boolean;
};

export const SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: "free",
    label: "Free",
    price: "$0",
    cadence: "MX / year",
    tagline: "Listed on Mesita.",
    visibility: "Minimum",
  },
  {
    id: "cashback",
    label: "Cashback",
    price: "$500",
    cadence: "MX / year",
    tagline: "Card runs through Mesita, returned to the guest's wallet.",
    visibility: "Maximum",
    featured: true,
  },
  {
    id: "discount",
    label: "Discount",
    price: "$500",
    cadence: "MX / year",
    tagline: "Guest shows the coupon, you discount the bill.",
    visibility: "Priority",
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

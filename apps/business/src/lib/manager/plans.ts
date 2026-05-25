import type { FiscalType, VenuePlan } from "@/lib/api/venues";

// Subscription catalog used by Promos (picker + label lookup).
//
// Five subscriptions, one per DB enum value, ordered ascending so the
// manager reads the picker left-to-right as a visibility ladder:
//   - "Free without promos"  (plan=free)                            · Low        · $0
//   - "Pro with Discounts"   (plan=informal_pro,   fiscal=informal) · Medium     · $500
//   - "Pro with Cashbacks"   (plan=formal_pro,     fiscal=formal)   · High       · $1,000
//   - "Ultra with Discounts" (plan=informal_ultra, fiscal=informal) · Extra high · $1,500
//   - "Ultra with Cashbacks" (plan=formal_ultra,   fiscal=formal)   · Max        · $3,000
//
// Mechanic is pinned by fiscal_type — Formal venues issue cashback through
// the wallet, Informal venues apply discounts at the bill. Pro vs Ultra
// only changes price and visibility tier; the workflow the manager sees
// for promos is identical inside a mechanic.
//
// Cashback tiers stay locked ("Coming soon") until the Mesita-in-the-loop
// payment + wallet settlement path ships. The cards still render so the
// ladder reads end-to-end, but the picker rejects selection.

export type PlanMechanic = "None" | "Cashback" | "Discount";
export type PlanVisibility = "Low" | "Medium" | "High" | "Extra high" | "Max";

// Picker id — one per card.
export type SubscriptionId =
  | "free"
  | "pro_discount"
  | "pro_cashback"
  | "ultra_discount"
  | "ultra_cashback";

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
  // Locks the card in the picker — renders as "Coming soon" and rejects
  // selection. Used while the payment/settlement plumbing for a tier is
  // not live yet (both cashback tiers at the moment — Mesita-in-the-loop
  // card flow is still on the roadmap). Mutually exclusive with `featured`
  // in the visual sense: when both are set, comingSoon wins in the UI.
  comingSoon?: boolean;
};

export const SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: "free",
    label: "Free without promos",
    price: "$0",
    cadence: "MX / year",
    tagline: "Listed on Mesita.",
    visibility: "Low",
  },
  {
    id: "pro_discount",
    label: "Pro with Discounts",
    price: "$500",
    cadence: "MX / year",
    tagline: "Guest shows the coupon, you discount the bill.",
    visibility: "Medium",
    setup: "1 min",
  },
  {
    id: "pro_cashback",
    label: "Pro with Cashbacks",
    price: "$1,000",
    cadence: "MX / year",
    tagline: "Card runs through Mesita, returned to the guest's wallet.",
    visibility: "High",
    setup: "10 min · connect business",
    // Locked until the Mesita-in-the-loop payment + wallet settlement path
    // ships. See header comment.
    comingSoon: true,
  },
  {
    id: "ultra_discount",
    label: "Ultra with Discounts",
    price: "$1,500",
    cadence: "MX / year",
    tagline: "Same coupon flow, top-of-ladder visibility.",
    visibility: "Extra high",
    setup: "1 min",
  },
  {
    id: "ultra_cashback",
    label: "Ultra with Cashbacks",
    price: "$3,000",
    cadence: "MX / year",
    tagline: "Wallet flow with maximum visibility — Mesita's flagship tier.",
    visibility: "Max",
    setup: "10 min · connect business",
    featured: true,
    // Locked alongside Pro Cashback until the wallet/settlement path ships.
    comingSoon: true,
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
  if (p === "formal_pro" || p === "formal_ultra") return "Cashback";
  return "Discount";
}

export function visibilityForPlan(p: VenuePlan): PlanVisibility {
  if (p === "free") return "Low";
  if (p === "informal_pro") return "Medium";
  if (p === "formal_pro") return "High";
  if (p === "informal_ultra") return "Extra high";
  return "Max"; // formal_ultra
}

export function subscriptionForVenue(p: VenuePlan): SubscriptionId {
  if (p === "free") return "free";
  if (p === "informal_pro") return "pro_discount";
  if (p === "formal_pro") return "pro_cashback";
  if (p === "informal_ultra") return "ultra_discount";
  return "ultra_cashback"; // formal_ultra
}

// Atomic write payload for the picker — one card click sets both plan
// and fiscal_type in a single apiUpdateVenue call.
export function dbStateForSubscription(sub: SubscriptionId): {
  plan: VenuePlan;
  fiscal_type?: FiscalType;
} {
  if (sub === "free") return { plan: "free" };
  if (sub === "pro_discount")
    return { plan: "informal_pro", fiscal_type: "informal" };
  if (sub === "pro_cashback")
    return { plan: "formal_pro", fiscal_type: "formal" };
  if (sub === "ultra_discount")
    return { plan: "informal_ultra", fiscal_type: "informal" };
  return { plan: "formal_ultra", fiscal_type: "formal" }; // ultra_cashback
}

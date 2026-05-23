import type { VenuePlan } from "@/lib/api/venues";
import type { FiscalType } from "@/components/shared";

// Subscription catalog used by Promos (picker + label lookup).
//
// Three subscriptions, one per DB enum value, ordered ascending so the
// manager reads the picker left-to-right as a ladder:
//   - "Free without promos"  (plan=free)                          · Low    · $0
//   - "Pro with Discounts"   (plan=informal_pro, fiscal=informal) · Medium · $500
//   - "Pro with Cashbacks"   (plan=formal_pro,   fiscal=formal)   · High   · $1000
//
// Pro with Cashbacks costs 2× Pro with Discounts because it captures the
// wallet flow — Mesita runs the payment, returns part to the guest's
// wallet, and the venue lands on High visibility. Pro with Discounts is
// the lower-commitment tier: same promo tooling, Medium visibility, but
// Mesita is not in the payment loop.

export type PlanMechanic = "None" | "Cashback" | "Discount";
export type PlanVisibility = "Low" | "Medium" | "High";

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
  // Locks the card in the picker — renders as "Coming soon" and rejects
  // selection. Used while the payment/settlement plumbing for a tier is
  // not live yet (cashback at the moment — Mesita-in-the-loop card flow
  // is still on the roadmap). Mutually exclusive with `featured`; when
  // both are set, comingSoon wins in the UI.
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
    id: "discount",
    label: "Pro with Discounts",
    price: "$500",
    cadence: "MX / year",
    tagline: "Guest shows the coupon, you discount the bill.",
    visibility: "Medium",
    setup: "1 min",
  },
  {
    id: "cashback",
    label: "Pro with Cashbacks",
    price: "$1,000",
    cadence: "MX / year",
    tagline: "Card runs through Mesita, returned to the guest's wallet.",
    visibility: "High",
    setup: "10 min · connect business",
    featured: true,
    // Locked until the Mesita-in-the-loop payment + wallet settlement
    // path ships. The card still renders (preserves the visibility
    // ladder + aspirational pink hint) but can't be selected — picker
    // surfaces a "Coming soon" badge in place of "Recommended".
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
  if (p === "formal_pro") return "Cashback";
  return "Discount";
}

export function visibilityForPlan(p: VenuePlan): PlanVisibility {
  if (p === "free") return "Low";
  if (p === "informal_pro") return "Medium";
  return "High";
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

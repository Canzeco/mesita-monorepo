import type { FiscalType, VenuePlan } from "@/lib/api/venues";

// Subscription catalog used by Promos (picker + label lookup).
//
// Five subscriptions, one per DB enum value, ordered ascending so the
// business reads the picker left-to-right as a visibility ladder:
//   - "Free without promos"  (plan=free)                            · Low        · $0
//   - "Pro with Discounts"   (plan=informal_pro,   fiscal=informal) · Medium     · $500
//   - "Pro with Rewards"     (plan=formal_pro,     fiscal=formal)   · High       · $1,000
//   - "Ultra with Discounts" (plan=informal_ultra, fiscal=informal) · Extra high · $1,500
//   - "Ultra with Rewards"   (plan=formal_ultra,   fiscal=formal)   · Max        · $3,000
//
// Every Verified venue runs an instant discount applied at the bill. Formal
// (invoiced) venues run the reward through Mesita; Informal (cash) venues
// apply the discount directly at the bill. Pro vs Ultra only changes price
// and visibility tier; the workflow the business sees for promos is
// identical inside a fiscal type.
//
// Reward tiers stay locked ("Coming soon") until the Mesita-in-the-loop
// payment + settlement path ships. The cards still render so the ladder
// reads end-to-end, but the picker rejects selection.

export type PlanVisibility = "Low" | "Medium" | "High" | "Extra high" | "Max";

// Picker id — one per card.
export type SubscriptionId =
  | "free"
  | "pro_discount"
  | "pro_reward"
  | "ultra_discount"
  | "ultra_reward";

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
  // Locks the card in the picker — renders as "Coming soon" and rejects
  // selection. Used while the payment/settlement plumbing for a tier is
  // not live yet (both reward tiers at the moment — Mesita-in-the-loop
  // card flow is still on the roadmap). Mutually exclusive with `featured`
  // in the visual sense: when both are set, comingSoon wins in the UI.
  comingSoon?: boolean;
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
    label: "Pro with Discounts",
    price: "MX$200",
    cadence: "/ month",
    tagline: "Consumer shows the coupon, you discount the bill.",
    visibility: "Medium",
    setup: "1 min",
  },
  {
    id: "pro_reward",
    label: "Pro with Rewards",
    price: "MX$400",
    cadence: "/ month",
    tagline: "Card runs through Mesita, the reward returns to the consumer.",
    visibility: "High",
    setup: "10 min · connect business",
    // Locked until the Mesita-in-the-loop payment + settlement path
    // ships. See header comment.
    comingSoon: true,
  },
  {
    id: "ultra_discount",
    label: "Ultra with Discounts",
    price: "MX$5,000",
    cadence: "/ month",
    tagline: "Same coupon flow, top-of-ladder visibility.",
    visibility: "Extra high",
    setup: "1 min",
  },
  {
    id: "ultra_reward",
    label: "Ultra with Rewards",
    price: "MX$10,000",
    cadence: "/ month",
    tagline: "Reward flow with maximum visibility — Mesita's flagship tier.",
    visibility: "Max",
    setup: "10 min · connect business",
    featured: true,
    // Locked alongside Pro Reward until the settlement path ships.
    comingSoon: true,
  },
];

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
  if (p === "formal_pro") return "pro_reward";
  if (p === "informal_ultra") return "ultra_discount";
  return "ultra_reward"; // formal_ultra
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
  if (sub === "pro_reward")
    return { plan: "formal_pro", fiscal_type: "formal" };
  if (sub === "ultra_discount")
    return { plan: "informal_ultra", fiscal_type: "informal" };
  return { plan: "formal_ultra", fiscal_type: "formal" }; // ultra_reward
}

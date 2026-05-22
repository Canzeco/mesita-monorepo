import type { VenuePlan } from "@/lib/api/venues";

// Plan catalog used by Promos (picker + label lookup). Single source of
// truth for plan copy and the mechanic / visibility derivation.
//
// Three plans: Free + two Pro tiers differentiated by the reward mechanic
// the venue runs. Pro Cashback is the premium tier — Mesita captures the
// transaction through Stripe + the wallet network and pays the venue the
// strongest visibility on every discovery surface in return. Pro Discount
// is the entry-level Pro tier — Mesita stays off the payment rail, so the
// price is lower and the visibility caps at Priority instead of Maximum.

export type PlanMechanic = "None" | "Cashback" | "Discount";
export type PlanVisibility = "Minimum" | "Priority" | "Maximum";

export type PlanRow = {
  id: VenuePlan;
  label: string;
  price: string;
  cadence: string;
  priceLabel: string;
  mechanic: PlanMechanic;
  visibility: PlanVisibility;
  fiscalScope: "any" | "formal" | "informal";
  blurb: string;
  bullets: string[];
  featured?: boolean;
};

export const PLANS: PlanRow[] = [
  {
    id: "free",
    label: "Free",
    price: "$0",
    cadence: "MX / year",
    priceLabel: "$0 MX / yr",
    mechanic: "None",
    visibility: "Minimum",
    fiscalScope: "any",
    blurb:
      "Auto-listed from Google Business. Discoverable + accepts AI reservations. No coupons, no dashboard writes.",
    bullets: ["Auto-listed", "AI reservations", "No coupon mechanic"],
  },
  {
    id: "informal_pro",
    label: "Pro Discount",
    price: "$200",
    cadence: "MX / year",
    priceLabel: "$200 MX / yr",
    mechanic: "Discount",
    visibility: "Priority",
    fiscalScope: "informal",
    blurb:
      "Instant discount on the bill. Priority placement on swipe and catalog. Entry-level Pro — Mesita stays off the payment rail. $200 MX / year, locked in.",
    bullets: [
      "Per-tier discount rates",
      "Discount revealed at the bill — cash or card",
      "Priority placement on swipe, map, catalog",
      "Place / Rewards / Team dashboard",
    ],
  },
  {
    id: "formal_pro",
    label: "Pro Cashback",
    price: "$1,000",
    cadence: "MX / year",
    priceLabel: "$1,000 MX / yr",
    mechanic: "Cashback",
    visibility: "Maximum",
    fiscalScope: "formal",
    blurb:
      "Cashback on card payments through Mesita. Maximum visibility everywhere, full wallet network, AI story verification before payout. 5× Pro Discount — the strongest discovery push Mesita offers, still under $85 / month.",
    bullets: [
      "Maximum visibility on swipe, map, catalog, AI planner",
      "Per-tier cashback rates",
      "Mesita wallet — guests redeem at any partner",
      "Story bonus & AI verification before payout",
      "Full Place / Rewards / Wallet / Team dashboard",
    ],
    featured: true,
  },
];

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

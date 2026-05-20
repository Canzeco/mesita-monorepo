import type { VenuePlan } from "@/lib/api/venues";

// Plan catalog used by Promos (picker + label lookup). Single source of
// truth for plan copy and the mechanic / visibility derivation.
//
// Three plans only: Free + one Pro per fiscal type. The Ultra tier was
// retired once Mesita's primary revenue stream became guest-side class
// subscriptions — venue billing is now intentionally simple.

export type PlanMechanic = "None" | "Cashback" | "Discount";
export type PlanVisibility = "Minimum" | "Priority";

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
    cadence: "MX / month",
    priceLabel: "$0 MX / mo",
    mechanic: "None",
    visibility: "Minimum",
    fiscalScope: "any",
    blurb:
      "Auto-listed from Google Business. Discoverable + accepts AI reservations. No coupons, no dashboard writes.",
    bullets: ["Auto-listed", "AI reservations", "No coupon mechanic"],
  },
  {
    id: "formal_pro",
    label: "Formal Pro",
    price: "$200",
    cadence: "MX / month",
    priceLabel: "$200 MX / mo",
    mechanic: "Cashback",
    visibility: "Priority",
    fiscalScope: "formal",
    blurb:
      "Cashback on card payments through Mesita. Priority placement across swipe, map, catalog, AI planner.",
    bullets: [
      "Per-tier cashback rates",
      "Mesita wallet — guests redeem at any partner",
      "Story bonus & AI verification",
      "Full Place / Rewards / Wallet / Team dashboard",
    ],
    featured: true,
  },
  {
    id: "informal_pro",
    label: "Informal Pro",
    price: "$400",
    cadence: "MX / month",
    priceLabel: "$400 MX / mo",
    mechanic: "Discount",
    visibility: "Priority",
    fiscalScope: "informal",
    blurb:
      "Instant discount on the cash bill. Priority placement. 2× formal because Mesita captures no wallet / data.",
    bullets: [
      "Per-tier discount rates",
      "Discount revealed at the bill — cash or card",
      "Story bonus & AI verification",
      "Place / Rewards / Team dashboard",
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
  return "Priority";
}

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
  priceLabel: string;
  mechanic: PlanMechanic;
  visibility: PlanVisibility;
  fiscalScope: "any" | "formal" | "informal";
  blurb: string;
};

export const PLANS: PlanRow[] = [
  {
    id: "free",
    label: "Free",
    priceLabel: "$0 MX / mo",
    mechanic: "None",
    visibility: "Minimum",
    fiscalScope: "any",
    blurb:
      "Scraped from Google Business. You appear minimally in discovery and accept AI reservations. No coupons, no dashboard writes.",
  },
  {
    id: "formal_pro",
    label: "Formal Pro",
    priceLabel: "$400 MX / mo",
    mechanic: "Cashback",
    visibility: "Priority",
    fiscalScope: "formal",
    blurb:
      "Cashback on card payments through Mesita. Priority placement across swipe, map, catalog, AI planner.",
  },
  {
    id: "informal_pro",
    label: "Informal Pro",
    priceLabel: "$800 MX / mo",
    mechanic: "Discount",
    visibility: "Priority",
    fiscalScope: "informal",
    blurb:
      "Instant discount on the cash bill. Priority placement. 2× formal price because Mesita captures no wallet / data.",
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

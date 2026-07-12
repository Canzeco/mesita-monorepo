import type { PlacePlan } from "@/lib/api/places";

// Subscription catalog used by place summaries (label lookup).
//
// Buzz v4 (MESITA-541): a place is either Free or Verified (MX$1,000/year).
// Strategy postures (Zero / Conservative / Aggressive / Dominant) live on
// the Promos page and are NOT separate Stripe products — paid postures all
// grant the same Verified membership (`plan=pro`). Legacy `ultra` folds onto
// Verified for display.

export type PlanVisibility = "Low" | "Medium" | "Max";

/** Catalog id — Free or the single Verified membership. */
export type SubscriptionId = "free" | "verified";

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
    cadence: "/ year",
    tagline: "Listed on Mesita.",
    visibility: "Low",
  },
  {
    id: "verified",
    label: "Verified",
    price: "MX$1,000",
    cadence: "/ year",
    tagline: "Membership — discounts at the bill, algorithm placement.",
    visibility: "Max",
    setup: "WhatsApp ping + first ticket",
    featured: true,
  },
];

/** True when the place holds Verified membership (any paid plan key). */
export function isVerifiedMember(p: PlacePlan): boolean {
  return p !== "free";
}

export function visibilityForPlan(p: PlacePlan): PlanVisibility {
  return isVerifiedMember(p) ? "Max" : "Low";
}

export function subscriptionForPlace(p: PlacePlan): SubscriptionId {
  return isVerifiedMember(p) ? "verified" : "free";
}

/** Plan key the billing EF expects for a catalog card. */
export function planForSubscription(sub: SubscriptionId): PlacePlan {
  return sub === "verified" ? "pro" : "free";
}

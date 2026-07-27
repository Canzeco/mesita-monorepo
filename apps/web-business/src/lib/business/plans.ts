import type { PlacePlan } from "@/lib/api/places";

// Subscription catalog used by place summaries (label lookup).
//
// Promos v4 (MESITA-541): a place is either Free or Verified (MX$1,000/year).
// Discount Strategies (Zero / Conservative / Aggressive) live on the Promos
// page and are NOT separate Stripe products — paid Strategies all grant the
// same Verified membership (`plan=pro`). Legacy `ultra` folds onto Verified
// for display.

/** Catalog id — Free or the single Verified membership. */
export type SubscriptionId = "free" | "verified";

type SubscriptionRow = {
  id: SubscriptionId;
  label: string;
  price: string;
  cadence: string;
  tagline: string;
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
  },
  {
    id: "verified",
    label: "Verified",
    price: "MX$1,000",
    cadence: "/ year",
    tagline: "Membership — discounts at the bill, algorithm placement.",
    setup: "WhatsApp ping + first ticket",
    featured: true,
  },
];

/** True when the place holds Verified membership (any paid plan key). */
function isVerifiedMember(p: PlacePlan): boolean {
  return p !== "free";
}

export function subscriptionForPlace(p: PlacePlan): SubscriptionId {
  return isVerifiedMember(p) ? "verified" : "free";
}

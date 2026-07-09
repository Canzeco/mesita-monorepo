// Subscription catalog for admin Promos (picker + visibility ladder).
// Ported from mesita-web-business-legacy / mesita-web-business.
//
// Visibility is cumulative: plan floor + discount generosity + ticket cap.
// Six levels (Low → Modest → Medium → High → Peak → Max). Plan cards show
// the floor each subscription alone contributes; the rail shows the live sum.
//
// Admin writes plan directly (no Stripe Checkout). Legacy formal_* rows
// still exist in the DB enum — fold them onto the matching discount tier.

/** Live visibility ladder — plan + discounts + cap. */
export type VisibilityLevel =
  | "Low"
  | "Modest"
  | "Medium"
  | "High"
  | "Peak"
  | "Max";

/** Plan-floor label on subscription cards (what the plan alone contributes). */
export type PlanVisibility = "Low" | "Medium" | "Peak";

export type SubscriptionId = "free" | "pro_discount" | "ultra_discount";

export type PlacePlan =
  | "free"
  | "pro"
  | "ultra"
  | "informal_pro"
  | "informal_ultra"
  | "formal_pro"
  | "formal_ultra"
  | string
  | null;

export const VISIBILITY_LEVELS: VisibilityLevel[] = [
  "Low",
  "Modest",
  "Medium",
  "High",
  "Peak",
  "Max",
];

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
    cadence: "/ month",
    tagline: "Listed on Mesita.",
    visibility: "Low",
  },
  {
    id: "pro_discount",
    label: "Pro",
    price: "MX$100",
    cadence: "/ month",
    tagline: "Consumer shows the coupon, you discount the bill.",
    visibility: "Medium",
    setup: "1 min",
  },
  {
    id: "ultra_discount",
    label: "Ultra",
    price: "MX$5,000",
    cadence: "/ month",
    tagline: "Same coupon flow — Peak floor; Max with strong promos.",
    visibility: "Peak",
    setup: "1 min",
    featured: true,
  },
];

/**
 * Plan floor. Pro alone → Medium; Ultra alone → Peak.
 * Max needs Ultra + strong discounts/cap; stingy promos can pull either down.
 */
function planPoints(p: PlacePlan): number {
  const sub = subscriptionForPlan(p);
  if (sub === "pro_discount") return 3;
  if (sub === "ultra_discount") return 6;
  return 0;
}

/**
 * Discount contribution: sum of the four rates / 70, capped at 4.
 * Max when every tier is 70% (280 / 70 = 4).
 */
function discountPoints(rates: (number | null | undefined)[]): number {
  const sum = rates.reduce<number>((acc, r) => acc + (typeof r === "number" ? r : 0), 0);
  return Math.min(4, sum / 70);
}

/**
 * Cap contribution: more generous caps (and no cap) score higher —
 * the place is willing to give consumers more per ticket.
 */
function capPoints(cap: number | null | undefined): number {
  if (cap == null) return 1;
  if (cap >= 2000) return 1;
  if (cap >= 1000) return 0.75;
  if (cap >= 500) return 0.5;
  return 0.25;
}

function levelForScore(score: number): VisibilityLevel {
  if (score <= 0) return "Low";
  if (score < 3) return "Modest";
  if (score < 5) return "Medium";
  if (score < 7) return "High";
  if (score < 9) return "Peak";
  return "Max";
}

export type VisibilityInput = {
  plan: PlacePlan;
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  monthly_promo_cap?: number | null;
};

/** Cumulative visibility from plan + discount rates + ticket cap. */
export function computeVisibility(input: VisibilityInput): VisibilityLevel {
  // Free stays Low — subscription buys the floor; rates/cap only stack on paid.
  if (subscriptionForPlan(input.plan) === "free") return "Low";

  const score =
    planPoints(input.plan) +
    discountPoints([
      input.welcome_free_rate,
      input.welcome_premium_rate,
      input.free_rate,
      input.premium_rate,
    ]) +
    capPoints(input.monthly_promo_cap);
  return levelForScore(score);
}

/** Plan-floor only — kept for subscription card labels / legacy callers. */
export function visibilityForPlan(p: PlacePlan): PlanVisibility {
  const sub = subscriptionForPlan(p);
  if (sub === "pro_discount") return "Medium";
  if (sub === "ultra_discount") return "Peak";
  return "Low";
}

export function subscriptionForPlan(p: PlacePlan): SubscriptionId {
  if (!p || p === "free") return "free";
  if (p === "pro" || p === "informal_pro" || p === "formal_pro") return "pro_discount";
  return "ultra_discount";
}

/** Atomic write payload for the plan picker — admin bypasses Stripe. */
export function dbStateForSubscription(sub: SubscriptionId): {
  plan: string;
  fiscal_type?: string;
} {
  if (sub === "pro_discount") return { plan: "informal_pro", fiscal_type: "informal" };
  if (sub === "ultra_discount") return { plan: "informal_ultra", fiscal_type: "informal" };
  return { plan: "free" };
}

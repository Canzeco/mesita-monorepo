import type { VenuePlan } from "@/lib/api/venues";
import type { FiscalType } from "@/components/shared";

// Plan catalog used by Promos (picker + label lookup).
//
// Two display plans: Free and Pro. Pro is one product at one price
// ($500 MX / year) regardless of mechanic — the mechanic itself
// (Cashback vs Discount) is elected separately, in its own section,
// because it's a capability axis (does the venue settle through Mesita?)
// rather than a pricing axis.
//
// Behind the scenes the DB still stores two Pro variants — formal_pro
// (Cashback) and informal_pro (Discount) — so the existing schema, RLS,
// and EFs don't churn. PROMO_FOR_FISCAL maps the manager's "Pro" click +
// their current fiscal_type into the right enum value at write time.
//
// Visibility still ladders by mechanic: a Pro Cashback venue lands on
// Maximum visibility while a Pro Discount venue caps at Priority. Same
// price; Cashback gets more value because Mesita captures the wallet flow.

export type PlanMechanic = "None" | "Cashback" | "Discount";
export type PlanVisibility = "Minimum" | "Priority" | "Maximum";

// Display ID — what the picker shows. Two cards: Free + Pro.
export type DisplayPlanId = "free" | "pro";

export type PlanRow = {
  id: DisplayPlanId;
  label: string;
  price: string;
  cadence: string;
  priceLabel: string;
  visibility: PlanVisibility;
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
    visibility: "Minimum",
    blurb:
      "Auto-listed on Mesita from your Google Business profile. You appear on the platform, but you can't offer promos and your visibility is lower than Pro.",
    bullets: [
      "Appears on the platform",
      "Auto-listed from Google Business",
      "Accepts AI reservations",
      "Lower visibility than Pro",
      "Cannot offer promos",
      "No automatic Instagram story verification",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    price: "$500",
    cadence: "MX / year",
    priceLabel: "$500 MX / yr",
    visibility: "Maximum",
    blurb:
      "Everything Free has, plus the tools to bring guests back. $500 / year, per venue, cancel anytime.",
    bullets: [
      "Appears on the platform",
      "More visibility than Free",
      "Can offer promos — Welcome coupon + per-tier rates",
      "Automatic Instagram story verification",
      "Accepts AI reservations",
    ],
    featured: true,
  },
];

// Mechanic still rides on the venue's fiscal_type — Formal venues issue
// cashback through the wallet, Informal venues apply discounts at the
// bill. The display label flips together with the toggle.
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

export function displayPlanForVenue(p: VenuePlan): DisplayPlanId {
  return p === "free" ? "free" : "pro";
}

// Manager click translation: clicking "Pro" picks the DB enum that
// matches the venue's current fiscal_type. Switching mechanic (the
// other box) flips the plan ID under the hood without changing the
// display tier.
export function dbPlanForSelection(
  selection: DisplayPlanId,
  fiscal: FiscalType,
): VenuePlan {
  if (selection === "free") return "free";
  return fiscal === "formal" ? "formal_pro" : "informal_pro";
}

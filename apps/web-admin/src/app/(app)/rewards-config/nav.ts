import type { LucideIcon } from "lucide-react";
import { BarChart3, Bike, Gift, UtensilsCrossed } from "lucide-react";

// Promos Config — three sub-tabs. CONTEXT cuts before identity (Notion §2.8),
// so the split is by context first: "Visits" prices the full identity grid
// (class × plan), "Orders" drops class and prices plan alone, "Distribution"
// simulates how visit prices spread across 1,000 visits.
//
// Labels are the bare nouns. The page heading already says Promos Config, and
// a tab that repeats its own heading stutters — same rule the sidebar follows
// ("the group says Configurations, so the item is Atlas, not Atlas Config").
//
// The route stays /rewards-config on purpose (decision D4-A) — the rename to
// "Promos Config" is copy-only.
export const REWARDS_PARENT = {
  href: "/rewards-config",
  label: "Promos",
  Icon: Gift,
} as const;

export const PROMOS_SUBROUTES = [
  { href: "/rewards-config/visits", label: "Visits", Icon: UtensilsCrossed },
  { href: "/rewards-config/orders", label: "Orders", Icon: Bike },
  {
    href: "/rewards-config/distribution",
    label: "Distribution",
    Icon: BarChart3,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

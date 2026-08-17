import type { LucideIcon } from "lucide-react";
import { BarChart3, Gift, Layers } from "lucide-react";

// Promos Config — two sub-tabs. "Tiers" prices every rate: four boxes, one per
// (strategy × context), because a place picks ONE strategy and reading its
// column gives that place's whole program. "Distribution" simulates how those
// prices spread across 1,000 visits.
//
// Labels are the bare nouns — the page heading already says Promos Config, and
// a tab that repeats its own heading stutters.
//
// The route stays /rewards-config on purpose (decision D4-A) — the rename to
// "Promos Config" is copy-only.
export const REWARDS_PARENT = {
  href: "/rewards-config",
  label: "Promos",
  Icon: Gift,
} as const;

export const PROMOS_SUBROUTES = [
  { href: "/rewards-config/tiers", label: "Tiers", Icon: Layers },
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

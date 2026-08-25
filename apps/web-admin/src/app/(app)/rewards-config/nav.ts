import type { LucideIcon } from "lucide-react";
import { BarChart3, Gift, Layers } from "lucide-react";

// Promos Config — two sub-tabs. Tiers prices every visit rate: three boxes,
// one per paid strategy. Orders Promos is a Soon field — no remote ticket.
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

import type { LucideIcon } from "lucide-react";
import { BarChart3, Gift, Settings2 } from "lucide-react";

// Promos Config (v10, MESITA-991) — two sub-tabs. "Config" prices the additive
// model (base + bonuses + default cap); "Distribution" simulates how those
// prices spread across 1,000 visits under operator assumptions (named for
// what it shows — MESITA-996; "playground" is Memo's live-chat idiom, not
// this). PROMOS_PARENT is the single Sidebar entry (Configs group);
// PROMOS_SUBROUTES are the in-page tabs, never added to the Sidebar.
//
// The route stays /rewards-config on purpose (decision D4-A) — the rename to
// "Promos Config" is copy-only.
export const REWARDS_PARENT = {
  href: "/rewards-config",
  label: "Promos Config",
  Icon: Gift,
} as const;

export const PROMOS_SUBROUTES = [
  { href: "/rewards-config/config", label: "Config", Icon: Settings2 },
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

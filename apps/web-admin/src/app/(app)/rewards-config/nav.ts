import type { LucideIcon } from "lucide-react";
import { FlaskConical, Gift, Settings2 } from "lucide-react";

// Promos Config (v10, MESITA-991) — two sub-tabs. "Config" prices the additive
// model (base + bonuses + default cap); "Playground" simulates the reward
// distribution over 1,000 visits under operator assumptions. PROMOS_PARENT is
// the single Sidebar entry (Configs group); PROMOS_SUBROUTES are the in-page
// tabs and are never added to the Sidebar (mirrors memo-config).
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
    href: "/rewards-config/playground",
    label: "Playground",
    Icon: FlaskConical,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

import { Gift } from "lucide-react";

// Promos Config — one page. Visit knobs, then the visit-spread simulator.
// No orders or prepaid knobs. No sub-tabs.
//
// The route stays /rewards-config on purpose (decision D4-A) — the rename to
// "Promos Config" is copy-only.
export const REWARDS_PARENT = {
  href: "/rewards-config",
  label: "Promos",
  Icon: Gift,
} as const;

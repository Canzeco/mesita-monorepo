import { Gift } from "lucide-react";

// Promos Config — one page. Visit knobs, Orders Soon, then the visit
// distribution simulator. No sub-tabs: a second page for a read-only chart
// of the same blob is a click for no new decision.
//
// The route stays /rewards-config on purpose (decision D4-A) — the rename to
// "Promos Config" is copy-only.
export const REWARDS_PARENT = {
  href: "/rewards-config",
  label: "Promos",
  Icon: Gift,
} as const;

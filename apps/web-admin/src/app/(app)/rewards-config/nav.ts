import { Gift } from "lucide-react";

// One sidebar entry — "Rewards Config". The six-segment reward grid (Promos v5,
// MESITA-723): what each segment pays under each posture. A single flat page,
// no sub-tabs.
export const REWARDS_PARENT = {
  href: "/rewards-config",
  label: "Rewards Config",
  Icon: Gift,
} as const;

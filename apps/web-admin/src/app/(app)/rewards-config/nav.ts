import { Gift } from "lucide-react";

// Rewards Config — one page. Visit knobs, then the visit-spread simulator.
// No orders or prepaid knobs. No sub-tabs.
//
// decision: Pato live 2026-09-02 (MESITA-1416) — the row is Rewards. "promo"
// left admin copy on 2026-08-30 and this rail row was the last surface still
// carrying it; the route has been /rewards-config all along, so the rename
// CLOSES a label/route gap rather than opening one. Copy only: the route, the
// `promos_config` blob, the `admin-web-*-rewards-config` EFs and the component
// names stay frozen, same as every rename before it.
export const REWARDS_PARENT = {
  href: "/rewards-config",
  label: "Rewards",
  Icon: Gift,
} as const;

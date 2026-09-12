import { Gift } from "lucide-react";

// Kept for bookmarks: /rewards-config permanently redirects to Visits.
// Visits Rewards (Pato, 2026-09-12) prices THE TICKET only — not orders,
// not prepaid. Not a sidebar row: rates a visit pays live on Visits, own
// blob (`promos_config`), own Save. Folder, EFs and this constant stay
// rewards-config / REWARDS_PARENT — a rename never reaches a URL, a
// column or an EF name.
export const REWARDS_PARENT = {
  href: "/visits-config",
  label: "Visits Rewards",
  Icon: Gift,
} as const;

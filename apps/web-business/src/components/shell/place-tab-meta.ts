// Each place page's name, icon and one line (MESITA-3151: "standardize
// design across pages"). The side menu and the page title read the same
// entry, so a page is drawn with the mark its menu row wears.

import { BadgeCheck, ClipboardList, Gift, Receipt, MapPinned, Settings, ShieldCheck, Sparkles, Star, type LucideIcon } from "lucide-react";
import type { PlaceTab } from "@/lib/routes";

export const PLACE_TAB_META: Record<PlaceTab, { label: string; icon: LucideIcon; sub: string }> = {
  visits: { label: "Visits", icon: ClipboardList, sub: "Who came, the bill and how it was paid." },
  profile: { label: "Profile", icon: MapPinned, sub: "What guests read about your place." },
  reviews: { label: "Reviews", icon: Star, sub: "What guests say on Google, Instagram and Facebook." },
  premier: { label: "Premier", icon: BadgeCheck, sub: "Rank higher on Home and the Map. Marked as an ad." },
  rewards: { label: "Rewards", icon: Gift, sub: "Discounts guests get on today's bill. Your place gives them." },
  // The one page about what is not on yet (MESITA-3197): copy only.
  soon: { label: "Soon", icon: Sparkles, sub: "What comes next for your place." },
  billing: { label: "Billing", icon: Receipt, sub: "What's running, what it costs and every charge." },
  settings: { label: "Settings", icon: Settings, sub: "Place and team." },
  admin: { label: "Admin", icon: ShieldCheck, sub: "Mesita staff only." },
};

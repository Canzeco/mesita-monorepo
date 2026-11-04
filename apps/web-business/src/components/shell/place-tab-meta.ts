// Each place page's name, icon and one line (MESITA-3151: "standardize
// design across pages"). The side menu and the page header read the same
// entry.

import type { Icon } from "@phosphor-icons/react";
import { EyeIcon, FootprintsIcon, GearIcon, GiftIcon, HourglassMediumIcon, MegaphoneIcon, ReceiptIcon, ShieldCheckIcon, StarIcon, StorefrontIcon } from "@phosphor-icons/react/dist/ssr";
import type { PlaceTab } from "@/lib/routes";

export const PLACE_TAB_META: Record<PlaceTab, { label: string; icon: Icon; sub: string }> = {
  views: { label: "Views", icon: EyeIcon, sub: "Who saw your place online." },
  visits: { label: "Visits", icon: FootprintsIcon, sub: "Who walked in, the bill and how it was paid." },
  profile: { label: "Profile", icon: StorefrontIcon, sub: "What guests read about your place." },
  reviews: { label: "Reviews", icon: StarIcon, sub: "What guests say on Google, Instagram and Facebook." },
  premier: { label: "Premier", icon: MegaphoneIcon, sub: "Rank higher on Home and the Map. Marked as an ad." },
  rewards: { label: "Rewards", icon: GiftIcon, sub: "Discounts guests get on today's bill. Your place gives them." },
  // The one page about what is not on yet (MESITA-3197): copy only. The line
  // is about Mesita, not the page (Pato, MESITA-3237).
  soon: {
    label: "Soon",
    icon: HourglassMediumIcon,
    sub: "Mesita is the ultimate marketing, financial and operations software for independent restaurants, taking your whole restaurant digital.",
  },
  billing: { label: "Billing", icon: ReceiptIcon, sub: "What's running, what it costs and every charge." },
  settings: { label: "Settings", icon: GearIcon, sub: "Place and team." },
  admin: { label: "Admin", icon: ShieldCheckIcon, sub: "Mesita staff only." },
};

// Each place page's name, icon and one line (MESITA-3151: "standardize
// design across pages"). The side menu and the page title read the same
// entry, so a page is drawn with the mark its menu row wears.

import { BadgeCheck, CreditCard, Receipt, Gift, UtensilsCrossed, MapPinned, Settings, ShieldCheck, Star, type LucideIcon } from "lucide-react";
import type { PlaceTab } from "@/lib/routes";

export const PLACE_TAB_META: Record<PlaceTab, { label: string; icon: LucideIcon; sub: string; soon?: boolean }> = {
  profile: { label: "Profile", icon: MapPinned, sub: "What guests read about your place." },
  reviews: { label: "Reviews", icon: Star, sub: "What guests say on Google, Instagram and Facebook." },
  premier: { label: "Premier", icon: BadgeCheck, sub: "Rank higher on Home and the Map. Marked as an ad." },
  payments: { label: "Payments", icon: CreditCard, sub: "Coming to Mesita for your place. Nothing here is on yet.", soon: true },
  products: { label: "Products", icon: UtensilsCrossed, sub: "Coming to Mesita for your place. Nothing here is on yet.", soon: true },
  rewards: { label: "Rewards", icon: Gift, sub: "Coming to Mesita for your place. Nothing here is on yet.", soon: true },
  billing: { label: "Billing", icon: Receipt, sub: "The plan, the card on it and every charge." },
  settings: { label: "Settings", icon: Settings, sub: "Who runs this place and its team." },
  admin: { label: "Admin", icon: ShieldCheck, sub: "Mesita staff only: who runs this place and its requests." },
};

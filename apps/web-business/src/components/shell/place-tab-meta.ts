// Each place page's name, icon and one line (MESITA-3151: "standardize
// design across pages"). The side menu and the page header read the same
// entry.

import type { Icon } from "@phosphor-icons/react";
import {
  CalendarCheckIcon,
  CoinsIcon,
  DotsThreeCircleIcon,
  EyeIcon,
  FootprintsIcon,
  GearIcon,
  SlidersHorizontalIcon,
  GiftIcon,
  InstagramLogoIcon,
  MegaphoneIcon,
  MoneyIcon,
  ShieldCheckIcon,
  StorefrontIcon,
  TagIcon,
  TicketIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { PlaceTab } from "@/lib/routes";

// Discounts left with the discount product (MESITA-3299). Monitor is
// Views · Visits · Vouchers · Payments · Credits · Customers, plain linked
// lists with no charts (MESITA-4538); Stories lives in General. General wears the gear (Pato,
// MESITA-4534: "general icon must be a gear").
export const PLACE_TAB_META: Record<PlaceTab, { label: string; icon: Icon; sub: string }> = {
  views: { label: "Views", icon: EyeIcon, sub: "Who saw your place online." },
  visits: { label: "Visits", icon: FootprintsIcon, sub: "Every bill at your place." },
  vouchers: { label: "Vouchers", icon: TicketIcon, sub: "Prepayments guests bought here." },
  stories: { label: "Stories", icon: InstagramLogoIcon, sub: "Story tickets, including ones waiting for a look." },
  gifts: { label: "Gifts", icon: GiftIcon, sub: "Credit guests sent each other here." },
  money: { label: "Payments", icon: MoneyIcon, sub: "Bills paid with Mesita, and payouts to your bank." },
  credits: { label: "Credits", icon: CoinsIcon, sub: "Every credit movement here, gifts included." },
  customers: { label: "Customers", icon: UsersThreeIcon, sub: "Who comes, and how much credit you owe them." },
  profile: { label: "Profile", icon: StorefrontIcon, sub: "What guests read about your place." },
  premier: { label: "Premier", icon: MegaphoneIcon, sub: "Ad spots on Home and the Map. Marked as an ad." },
  // Offers (MESITA-4530, Pato: "rename payment pages to offers"); the URL stays
  // /payments, where Stripe returns.
  payments: { label: "Offers", icon: TagIcon, sub: "Choose how guests pay you and earn credit here. Money and payouts are on Monitor › Payments." },
  general: { label: "General", icon: GearIcon, sub: "Reservations, Stories and Settings." },
  reservations: { label: "Reservations", icon: CalendarCheckIcon, sub: "Whether guests can ask for a table here." },
  // Every product, current and future (MESITA-3238; was Soon, MESITA-3197). The
  // line is about Mesita, not the page (Pato, MESITA-3237); it leads with "the
  // Shopify for independent restaurants" (Pato, MESITA-3866).
  all: {
    label: "All",
    icon: DotsThreeCircleIcon,
    sub: "Mesita Suite is the Shopify for independent restaurants: one platform for marketing, payments and operations.",
  },
  settings: { label: "Settings", icon: SlidersHorizontalIcon, sub: "Place and team." },
  admin: { label: "Admin", icon: ShieldCheckIcon, sub: "Mesita staff only." },
};

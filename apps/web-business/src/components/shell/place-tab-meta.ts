// Each place page's name, icon and one line (MESITA-3151: "standardize
// design across pages"). The side menu and the page header read the same
// entry.

import type { Icon } from "@phosphor-icons/react";
import {
  CalendarCheckIcon,
  DotsThreeCircleIcon,
  EyeIcon,
  FootprintsIcon,
  GearIcon,
  GiftIcon,
  InstagramLogoIcon,
  MegaphoneIcon,
  MoneyIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  StorefrontIcon,
  TagIcon,
  TicketIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { PlaceTab } from "@/lib/routes";

// Discounts left with the discount product (MESITA-3299). Monitor is
// Views · Visits · Vouchers · Gifts; Stories and Money live in General
// (MESITA-4528). Money stays the cash ledger. The four ticket pages list every
// ticket of that kind and the last 30 days.
export const PLACE_TAB_META: Record<PlaceTab, { label: string; icon: Icon; sub: string }> = {
  views: { label: "Views", icon: EyeIcon, sub: "Who saw your place online." },
  visits: { label: "Visits", icon: FootprintsIcon, sub: "Who came and paid with Mesita." },
  vouchers: { label: "Vouchers", icon: TicketIcon, sub: "Prepayments guests bought here." },
  stories: { label: "Stories", icon: InstagramLogoIcon, sub: "Story tickets, including ones waiting for a look." },
  gifts: { label: "Gifts", icon: GiftIcon, sub: "Credit guests sent each other here." },
  money: { label: "Money", icon: MoneyIcon, sub: "Every payment and voucher at your place." },
  profile: { label: "Profile", icon: StorefrontIcon, sub: "What guests read about your place." },
  premier: { label: "Premier", icon: MegaphoneIcon, sub: "Ad spots on Home and the Map. Marked as an ad." },
  // Offers (MESITA-4530, Pato: "rename payment pages to offers"); the URL stays
  // /payments, where Stripe returns.
  payments: { label: "Offers", icon: TagIcon, sub: "Choose how guests pay you and earn credit here. Money and payouts are on General › Money." },
  general: { label: "General", icon: SlidersHorizontalIcon, sub: "Reservations, Stories, Money and Settings." },
  reservations: { label: "Reservations", icon: CalendarCheckIcon, sub: "Whether guests can ask for a table here." },
  // Every product, current and future (MESITA-3238; was Soon, MESITA-3197). The
  // line is about Mesita, not the page (Pato, MESITA-3237); it leads with "the
  // Shopify for independent restaurants" (Pato, MESITA-3866).
  all: {
    label: "All",
    icon: DotsThreeCircleIcon,
    sub: "Mesita Suite is the Shopify for independent restaurants: one platform for marketing, payments and operations.",
  },
  settings: { label: "Settings", icon: GearIcon, sub: "Place and team." },
  admin: { label: "Admin", icon: ShieldCheckIcon, sub: "Mesita staff only." },
};

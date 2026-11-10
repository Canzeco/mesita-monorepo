// Each place page's name, icon and one line (MESITA-3151: "standardize
// design across pages"). The side menu and the page header read the same
// entry.

import type { Icon } from "@phosphor-icons/react";
import {
  CalendarCheckIcon,
  CreditCardIcon,
  DotsThreeCircleIcon,
  EyeIcon,
  FootprintsIcon,
  GearIcon,
  MegaphoneIcon,
  MoneyIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  StorefrontIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { PlaceTab } from "@/lib/routes";

// Discounts left with the discount product (MESITA-3299, Pato: "discounts are
// gone across all the app"). Operations is Views · Visits · Money
// (MESITA-3301; Money was Transactions for an hour, MESITA-3308): a visit is
// a guest paying here with Mesita, Money is every payment, voucher and
// cashback; both pages stand before any place takes payments (Pato: "keep the
// pages even if Mesita Payments is not enabled yet").
export const PLACE_TAB_META: Record<PlaceTab, { label: string; icon: Icon; sub: string }> = {
  views: { label: "Views", icon: EyeIcon, sub: "Who saw your place online." },
  visits: { label: "Visits", icon: FootprintsIcon, sub: "Who came and paid with Mesita." },
  money: { label: "Money", icon: MoneyIcon, sub: "Every payment, voucher and cashback at your place." },
  profile: { label: "Profile", icon: StorefrontIcon, sub: "What guests read about your place." },
  premier: { label: "Premier", icon: MegaphoneIcon, sub: "Rank higher on Home and the Map. Marked as an ad." },
  payments: { label: "Payments", icon: CreditCardIcon, sub: "Choose how guests pay you and earn credit here. Money and payouts are on Operations › Money." },
  reservations: { label: "Reservations", icon: CalendarCheckIcon, sub: "Whether guests can ask for a table here." },
  // Every product, current and future (MESITA-3238; was Soon, MESITA-3197). The
  // line is about Mesita, not the page (Pato, MESITA-3237).
  all: {
    label: "All",
    icon: DotsThreeCircleIcon,
    sub: "Mesita Suite is the marketing, payments and operations platform for independent restaurants.",
  },
  billing: { label: "Billing", icon: ReceiptIcon, sub: "What's running, what it costs and every charge." },
  settings: { label: "Settings", icon: GearIcon, sub: "Place and team." },
  admin: { label: "Admin", icon: ShieldCheckIcon, sub: "Mesita staff only." },
};

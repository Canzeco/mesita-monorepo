// Each place page's name, icon and one line (MESITA-3151: "standardize
// design across pages"). The side menu and the page header read the same
// entry.

import type { Icon } from "@phosphor-icons/react";
import {
  BankIcon,
  CalendarCheckIcon,
  CoinsIcon,
  CreditCardIcon,
  DotsThreeCircleIcon,
  EyeIcon,
  GearIcon,
  ReceiptIcon,
  SlidersHorizontalIcon,
  GiftIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  StorefrontIcon,
  TagIcon,
  TicketIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { PlaceTab } from "@/lib/routes";

// Discounts left with the discount product (MESITA-3299). Monitor is
// Customers · Views · Visits · Vouchers · Gifts · Payments · Payouts, plain linked
// lists with no charts (MESITA-4538). General wears the gear (Pato,
// MESITA-4534: "general icon must be a gear").
export const PLACE_TAB_META: Record<PlaceTab, { label: string; icon: Icon; sub: string }> = {
  views: { label: "Views", icon: EyeIcon, sub: "Who saw your place online." },
  // A receipt, not footprints (Pato, MESITA-4682: "it should express it's
  // financial"): each bill and how it was paid.
  visits: { label: "Visits", icon: ReceiptIcon, sub: "Every bill at your place, and how it was paid." },
  vouchers: { label: "Vouchers", icon: TicketIcon, sub: "Prepayments guests bought here." },
  gifts: { label: "Gifts", icon: GiftIcon, sub: "Credit a guest sent a friend." },
  // Payments and Payouts are two pages (MESITA-4679, Pato: "Customers, Views,
  // Visits, Vouchers, Gifts, Payments, Payouts"; one page called Stripe since
  // MESITA-4568). Payments' URL stays /money: Offers owns /payments.
  // Stripe card charges only since MESITA-4682 (Pato: "just mention the Stripe
  // Payments events"); cash and credit are on Visits.
  money: { label: "Payments", icon: CreditCardIcon, sub: "Card payments through Stripe." },
  payouts: { label: "Payouts", icon: BankIcon, sub: "Money Stripe sent to your bank." },
  credits: { label: "Credits", icon: CoinsIcon, sub: "Vouchers, gifts and visits: every credit movement here." },
  customers: { label: "Customers", icon: UsersThreeIcon, sub: "Guests who saved, visited or hold credit here." },
  profile: { label: "Profile", icon: StorefrontIcon, sub: "What guests read about your place." },
  premier: { label: "Premier", icon: MegaphoneIcon, sub: "Ad spots on Home and the Map. Marked as an ad." },
  // Offers (MESITA-4530, Pato: "rename payment pages to offers"); the URL stays
  // /payments, where Stripe returns.
  payments: { label: "Offers", icon: TagIcon, sub: "Choose how guests pay you and earn credit here. Money is on Monitor › Payments and Payouts." },
  general: { label: "General", icon: GearIcon, sub: "Reservations and Settings." },
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

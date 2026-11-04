import type { Icon } from "@phosphor-icons/react";
import {
  BookOpenIcon,
  BroadcastIcon,
  CalculatorIcon,
  CalendarCheckIcon,
  ChatCircleIcon,
  CreditCardIcon,
  GlobeIcon,
  MoneyIcon,
  MonitorIcon,
  ShoppingBagIcon,
  WalletIcon,
} from "@phosphor-icons/react/dist/ssr";

export const metadata = { title: "Soon" };

// The one page about what is not on yet (MESITA-3197), now a catalog of the
// software products to come (MESITA-3237, Pato: "like a catalog of software
// products"), in his order. Copy only: no links, forms, dates or sign-up, so a
// tile has no hover. One card of rows on a phone; tiles from `sm`, four across
// only from `2xl`, where "Reservations Management" still fits one line.
const SOON: Array<{ name: string; line: string; icon: Icon }> = [
  {
    name: "Digital Menu",
    line: "Your menu, built by AI from a photo, file or website, and approved by you. Every order source sells from it, and guests can browse it from a QR code.",
    icon: BookOpenIcon,
  },
  {
    name: "Express Website",
    line: "A website on your own domain, made from your Mesita profile with the same menu, hours and photos. Change it by asking, with ordering and reservation buttons already connected.",
    icon: GlobeIcon,
  },
  {
    name: "Digital Payments",
    line: "Guests pay from their phone into your own Stripe account, by card, Apple Pay or Google Pay. Staff can also show a QR code for a bill, no account needed.",
    icon: CreditCardIcon,
  },
  {
    name: "Credit Prepayments",
    line: "Guests buy credit ahead at a bonus you set, gift it or send it, and spend it only with you. One balance tracks every purchase, gift and redemption.",
    icon: WalletIcon,
  },
  {
    name: "Mesita Capital",
    line: "Cash upfront, by selling future credit at your restaurant to Mesita at a discount. Guests redeem that credit over time, so the funding brings visits with it.",
    icon: MoneyIcon,
  },
  {
    name: "Marketing Agent",
    line: "Creates your photos, videos and posts, publishes them on your social media and runs your paid ads on Instagram, Facebook and Google. You approve everything from one queue.",
    icon: BroadcastIcon,
  },
  {
    name: "Answering Agent",
    line: "Answers phone, WhatsApp and text with your current hours and menu. Turns questions into orders and bookings while your staff focus on service.",
    icon: ChatCircleIcon,
  },
  {
    name: "Orders Management",
    line: "Every order in one queue, from Uber Eats, Rappi, DiDi Food, your website and Mesita. Manage status, prep time and sold-out items in one place.",
    icon: ShoppingBagIcon,
  },
  {
    name: "Reservations Management",
    line: "Every booking in one calendar, from Mesita, your website, your agents and outside booking systems. Manage availability, confirmations and changes from this console.",
    icon: CalendarCheckIcon,
  },
  {
    name: "Mesita Terminal",
    line: "A card device connected to the Mesita bill. Guests tap or insert their card at the counter or table, and staff see the result on the right ticket.",
    icon: CalculatorIcon,
  },
  {
    name: "Mesita POS",
    line: "Take orders, track the kitchen and close bills on a point of sale connected to your menu. Counter, table and online sales share the same guest and payment records.",
    icon: MonitorIcon,
  },
];

export default function SoonPage() {
  return (
    <div className="pb-8">
      <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent xl:grid-cols-3 2xl:grid-cols-4">
        {SOON.map(({ name, line, icon: Mark }) => (
          <li
            key={name}
            className="sm:border-border sm:bg-card flex gap-3 px-4 py-3.5 sm:flex-col sm:gap-4 sm:rounded-2xl sm:border sm:p-6"
          >
            <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-xl sm:size-11">
              <Mark size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold sm:text-base">{name}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{line}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Icon } from "@phosphor-icons/react";
import {
  BookOpenIcon,
  BroadcastIcon,
  CalculatorIcon,
  CalendarCheckIcon,
  ChatCircleIcon,
  GlobeIcon,
  MoneyIcon,
  MonitorIcon,
  ShoppingBagIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PLACE_TAB_META } from "@/components/shell/place-tab-meta";
import { placeTabHref, type PlaceTab } from "@/lib/routes";
import { FOCUS_RING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export const metadata = { title: "All" };

// Every product, current and future (MESITA-3238, Pato: "call that page (All)
// ... mention current and future and divide"; a catalog since MESITA-3237, was
// Soon, MESITA-3197). A current tile is a Capabilities row of the rail, same name
// and icon, and opens its page; Views stays out as Operations (Pato,
// MESITA-3243); Reservations joined Current with the rail (MESITA-3853). A future tile is copy only: no links, forms, dates or sign-up,
// so it has no hover. One card of rows on a phone; tiles from `sm`, four across
// only from `2xl`, where "Reservations Management" still fits one line.
const CURRENT: Array<{ tab: PlaceTab; line: string }> = [
  {
    tab: "profile",
    line: "What guests read about your place: basics, hours, location and links, and what they say on Google, Instagram and Facebook. Edit it here and preview it the way guests see it.",
  },
  {
    tab: "premier",
    line: "Rank higher on Home and the Map, marked as an ad. See your level here and how it works.",
  },
  {
    tab: "payments",
    line: "House Credits, Cash Payments, App Payments, their Cashback-as-Credits, App Prepayments and the Stripe Account, and which of them are on at your place.",
  },
  {
    tab: "reservations",
    line: "Whether guests can ask for a table at your place. When they do, Mesita's Reservationist calls you with the date, time and party size.",
  },
];

const FUTURE: Array<{ name: string; line: string; icon: Icon }> = [
  {
    name: "Smart Menu",
    line: "Your interactive menu, built by AI from a photo, file or website, approved by you and hosted on Mesita. Guests open it from a QR code or link with no account, ask its AI questions, and order and pay directly, at your place or from anywhere.",
    icon: BookOpenIcon,
  },
  {
    name: "Express Website",
    line: "A website on your own domain, made from your Mesita profile with the same menu, hours and photos. Change it by asking, with ordering and reservation buttons already connected.",
    icon: GlobeIcon,
  },
  {
    name: "Mesita Capital",
    line: "Cash upfront, by selling an agreed amount of future credit at your restaurant to Mesita at a discount. Mesita gives that credit to guests, who redeem it over time, so the funding brings visits with it.",
    icon: MoneyIcon,
  },
  {
    name: "Marketing Agent",
    line: "Connects to Google and Meta. Uses Higgsfield to turn your profile data and guests' Instagram Stories, with their permission, into AI content made to go viral. Create your content, post it to your feed and boost it with ads on every channel, all from one place.",
    icon: BroadcastIcon,
  },
  {
    name: "Answering Agent",
    line: "Agents connected to all your channels, including phone, WhatsApp and text, that know your business: hours, menu and bookings. They turn questions into orders and bookings, so your staff get structured information instead of scattered calls and messages.",
    icon: ChatCircleIcon,
  },
  {
    name: "Orders Management",
    line: "One queue for every order, labeled by source: Mesita members, your website and agents, and Uber Eats, Rappi and DiDi Food. Manage status, prep time, cancellations and sold-out items, and see the day's delivery sales.",
    icon: ShoppingBagIcon,
  },
  {
    name: "Reservations Management",
    line: "One calendar for every booking, labeled by source: Mesita members, your website and agents, and outside booking systems, synced so tables aren't double-booked. Manage availability, confirmations, reminders, changes and cancellations, with every booking tied to its guest.",
    icon: CalendarCheckIcon,
  },
  {
    name: "Mesita CRM",
    line: "One record per guest, built from every booking, order, visit and redemption, with history, notes, tags and preferences so staff recognize who's at the door. Message guests on WhatsApp, SMS and email from that record, with every message logged.",
    icon: UsersThreeIcon,
  },
  {
    name: "Mesita Terminal",
    line: "A card device connected to the Mesita bill. Guests tap or insert their card at the counter or table, staff see the result on the right ticket, and online and in-person payments reconcile in one place.",
    icon: CalculatorIcon,
  },
  {
    name: "Mesita POS",
    line: "Take orders, track the kitchen and close bills on a point of sale connected to your Smart Menu. Counter, table and online sales share the same guest, rewards and payment records.",
    icon: MonitorIcon,
  },
];

const GRID =
  "border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent xl:grid-cols-3 2xl:grid-cols-4";

const TILE =
  "sm:border-border sm:bg-card flex h-full gap-3 px-4 py-3.5 sm:flex-col sm:gap-4 sm:rounded-2xl sm:border sm:p-6";

function TileFace({ name, line, icon: Mark }: { name: string; line: string; icon: Icon }) {
  return (
    <>
      <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-xl sm:size-11">
        <Mark size={20} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold sm:text-base">{name}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">{line}</p>
      </div>
    </>
  );
}

export default async function AllPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-8 pb-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Current</h2>
        <ul className={GRID}>
          {CURRENT.map(({ tab, line }) => {
            const { label, icon } = PLACE_TAB_META[tab];
            return (
              <li key={tab}>
                <Link
                  href={placeTabHref(id, tab)}
                  className={cn(TILE, FOCUS_RING_CLASS, "hover:bg-muted/50 sm:hover:bg-muted/50 transition")}
                >
                  <TileFace name={label} line={line} icon={icon} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Future</h2>
        <ul className={GRID}>
          {FUTURE.map((product) => (
            <li key={product.name} className={TILE}>
              <TileFace {...product} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

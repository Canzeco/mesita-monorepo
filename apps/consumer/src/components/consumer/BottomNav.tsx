"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  CalendarCheck,
  Ticket,
  QrCode,
  Share2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Six top-level surfaces. Coupons and Pay split apart so the wallet
// surface stays focused on the coupons list, and Pay owns its own tab
// for the QR-to-pay + cashback balance — the two ideas had been folded
// together but they answer different intents ("show me my deals" vs
// "I'm at the bill, scan me").
//
//   Discover     — Swipe / Map / Catalog / Search / AI / Saved
//                  sub-tabs.
//   Reservations — booking entries only, no money fields shown.
//   Coupons      — the coupons wallet (active / used / expired).
//   Pay          — the QR-to-pay + cashback balance.
//   Share        — referral.
//   Profile      — account / settings.
//
// Six items is tight at narrow widths; the label font-size + flex-1
// distribution scales it; truncate guards against the longest label
// ("Reservations") overflowing its column on edge devices.
const ITEMS = [
  {
    href: "/discover/swipe",
    Icon: Compass,
    label: "Discover",
    match: "/discover",
  },
  {
    href: "/reservations",
    Icon: CalendarCheck,
    label: "Reservations",
    match: "/reservations",
  },
  { href: "/coupons", Icon: Ticket, label: "Coupons", match: "/coupons" },
  { href: "/pay", Icon: QrCode, label: "Pay", match: "/pay" },
  { href: "/share", Icon: Share2, label: "Share", match: "/share" },
  {
    href: "/profile",
    Icon: User,
    label: "Profile",
    match: "/profile",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border bg-card/95 sticky bottom-0 z-40 shrink-0 border-t px-1 pt-2 backdrop-blur">
      <div className="flex justify-around">
        {ITEMS.map(({ href, Icon, label, match }) => {
          const active = pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              <span className="w-full truncate text-center">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}

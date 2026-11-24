"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ReceiptText } from "lucide-react";
import { money } from "@/lib/api/wallet";
import { barShowsOn, CONSUMER_ROUTES, isAtRoute } from "@/lib/consumer-route-contract";
import { useOpenBill } from "./use-open-bill";

// THE TICKET IN PROGRESS, ON EVERY TAB (MESITA-3906, Pato: "what happens if
// the app closes ... if i open app in my profile"): while the guest has a
// ticket they haven't paid or cancelled, a slim amber row sits at the very
// top of the app, above every header, on every screen that shows the bar,
// /pay included (MESITA-4069, Pato: "on top of the header, at the top of the
// app, like the yellow warning"; it sat above the tab bar under MESITA-4051),
// and opens it. Nothing under /pay shows it: the bill's own screens, and
// /pay itself, which draws the bill as a panel in the page (MESITA-4086,
// Pato: "if I am in the pay page, then actually show the payment ticket
// not in the header but in the center").
//
// A bill the waiter sent: to review, then to pay at the place (MESITA-4823).

export function PendingTicketBanner() {
  const pathname = usePathname() ?? "/";
  // /pay draws it in the page (OpenBillPanel); the bill's screens are it.
  const onPay = isAtRoute(pathname, CONSUMER_ROUTES.pay);
  // MESITA-4823: one open bill, read when the app opens, each time the guest
  // leaves Pay, and when the app comes back to the front.
  const bill = useOpenBill(!onPay);
  if (onPay || !barShowsOn(pathname) || !bill) return null;
  const href = CONSUMER_ROUTES.payCode;
  const name = bill.place.name;
  const what =
    bill.state === "sent" ? "Bill to review" : bill.quote ? `Pay ${money(bill.quote.outside_cents, bill.currency)}` : "Waiting for the waiter";

  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
      data-pending-ticket
    >
      {/* A WARNING BANNER, TWO LINES (Pato, 2026-11-15, MESITA-4088: "top
          ticket can and must be taller like the warning ticket"): ~64px,
          the state bold over the place's name. MESITA-4087 had cut it to
          one ~37px line for a few hours. */}
      <ReceiptText className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{what}</span>
        {name ? (
          <span className="truncate text-sm text-amber-800">{name}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center text-base font-semibold">
        Continue
        <ChevronRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}

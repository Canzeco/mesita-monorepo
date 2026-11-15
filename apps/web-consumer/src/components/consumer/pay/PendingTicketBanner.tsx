"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ReceiptText } from "lucide-react";
import { apiListVisits } from "@/lib/api/tab";
import {
  barShowsOn,
  CONSUMER_ROUTES,
  isAtRoute,
  payPlacePath,
  payBillPath,
} from "@/lib/consumer-route-contract";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { pendingTicket } from "./GuestPayScreen";

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
// Two kinds: one being filled in (Bill · Tip · Method · Pay), kept on this
// phone (GuestPayScreen's draft, 30 minutes), and a bill already sent and
// waiting for the waiter's signature, found on the server once when the app
// opens and again each time the guest leaves Pay.

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const localSnapshot = () => {
  const t = pendingTicket();
  return t ? `${t.placeId}\n${t.name ?? ""}` : "";
};

/** The ticket being filled in on this phone, re-read on every render. */
export function usePendingTicket(): {
  placeId: string;
  name: string | null;
} | null {
  const local = useSyncExternalStore(subscribe, localSnapshot, () => "");
  if (!local) return null;
  const [placeId, name] = local.split("\n");
  return { placeId, name: name || null };
}

export function PendingTicketBanner() {
  const pathname = usePathname() ?? "/";
  // /pay draws it in the page (OpenBillPanel); the bill's screens are it.
  const onPay = isAtRoute(pathname, CONSUMER_ROUTES.pay);
  const getSupabase = useLazyBrowserSupabase();
  // Read on every render, so a route change sees what Pay just wrote.
  const local = useSyncExternalStore(subscribe, localSnapshot, () => "");
  const [bill, setBill] = useState<{
    tabId: string;
    name: string | null;
  } | null>(null);

  useEffect(() => {
    if (onPay) return;
    let alive = true;
    void apiListVisits(getSupabase())
      .then((r) => {
        const v = pickOpenGuestPayment(r.visits, Date.now());
        if (alive) setBill(v ? { tabId: v.tab_id, name: v.place.name } : null);
      })
      .catch(() => {
        // Offline: the phone's own ticket still shows.
      });
    return () => {
      alive = false;
    };
  }, [onPay, getSupabase]);

  if (onPay || !barShowsOn(pathname)) return null;
  const [placeId, localName] = local ? local.split("\n") : [];
  const href = bill
    ? payBillPath(bill.tabId)
    : placeId
      ? payPlacePath(placeId)
      : null;
  if (!href) return null;
  const name = (bill ? bill.name : localName) || null;
  const what = bill ? "Waiting for the waiter's signature" : "Bill in progress";

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

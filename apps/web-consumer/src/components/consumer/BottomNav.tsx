"use client";

import { Z_BOTTOM_NAV } from "@/lib/z-index";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useRef,
  type ComponentType,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { QrCode, Search, Share2, User } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { SizedImg } from "@mesita/place-profile";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { cn } from "@/lib/utils";
import {
  CONSUMER_ROUTES,
  barShowsOn,
  tabFor,
  type ConsumerTab,
} from "@/lib/consumer-route-contract";
import { trackEvent } from "@/lib/analytics/track";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { setPendingTab, usePendingTab } from "@/lib/pending-tab";
import { useUnseenNotifications } from "./use-unseen-notifications";

// FIVE TABS, in this order (Pato, 2026-11-14, MESITA-3855: "Home Search
// Pay Share Me. EASY PEASY"):
//
//   Home · Search · Pay · Share · Me
//
// SHARE IS A TAB AGAIN (MESITA-3867, Pato: "i actually want a share page"):
// it opens /share, one card of channel rows, and lights there like any tab.
// For a day it was a button that fired the share sheet and opened nothing
// (MESITA-3855); before that a page (MESITA-2566) and Me's tile (MESITA-2871).
//
// ACTIVITY LEFT THE BAR (MESITA-3855, Pato: "We are going to remove Activity
// too"): its chips are Me's Notifications, Reservations and Tickets pages. It
// held the fourth tab from MESITA-3769 (and MESITA-3631 before), a page
// under Me for a day between (MESITA-3717/3726).
//
//   ME WEARS A RED DOT while a notification is newer than the last one this
//   device showed (MESITA-3717, Pato: "if there is an event not viewed yet,
//   put red bubble"; on Activity from MESITA-3769 until MESITA-3855). Opening
//   Me › Notifications clears it.
//
//   PAY OWNS THE MONEY (MESITA-3726): it lights on every address under /pay
//   (/pay/<placeId>, /pay/tab/<id>, /pay/receipt/<id>) and on the Wallet,
//   a page pushed from Pay's header (/wallet, /wallet/<placeId>,
//   /wallet/gift/<token>), so a bill or a House Card keeps Pay lit.
//
// THE ME TAB WEARS THE GUEST'S PICTURE (Pato, MESITA-3077: "add profile
// picture to me instead", after first asking for it at Home's and Search's
// top right): a round photo where the person glyph was, as Instagram's bar
// does, from the shell-seeded profile row (a new photo shows at once). No
// picture, the glyph. The label still reads Me.
//
// Every tab shows its plain label. A tab label names a DESTINATION; state
// belongs on the page where it can be read and acted on (Pato, 2026-08-16:
// "only write me, its cleaner"). `route-structure.test.tsx` pins the labels,
// in order, and their count.

// Every icon is a lucide glyph except Home's, which carries the brand mark.
// The signature stays wider than LucideIcon so the mark fits.
type Item = {
  href: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  /** The tab this item is. Which screens light it is ROUTE_MAP's `tab`
   *  (lib/consumer-route-contract.ts, MESITA-3646): a place lights Home, a
   *  House Card Pay, a reservation or a ticket Me. */
  tab: ConsumerTab;
};

const ITEMS: Item[] = [
  {
    // Home lands on Places and lights on both its tabs, /home/places and
    // /home/social (MESITA-2597).
    href: CONSUMER_ROUTES.home,
    Icon: MesitaMark,
    label: "Home",
    tab: "home",
  },
  {
    href: CONSUMER_ROUTES.search,
    Icon: Search,
    label: "Search",
    tab: "search",
  },
  {
    href: CONSUMER_ROUTES.pay,
    Icon: QrCode,
    // Pay again (Pato, MESITA-3291: "rename the page Reward to Pay"; it read
    // Reward from MESITA-3211 until then).
    label: "Pay",
    tab: "pay",
  },
  {
    href: CONSUMER_ROUTES.share,
    Icon: Share2,
    label: "Share",
    tab: "share",
  },
  {
    href: CONSUMER_ROUTES.me,
    Icon: User,
    label: "Me",
    tab: "me",
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const avatarUrl = useConsumerProfile().data?.avatar_url ?? null;
  const unseen = useUnseenNotifications();
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  // EACH TAB IS A PLAIN LINK WITH NEXT'S OWN PREFETCH (MESITA-3013). The app
  // is served at its real paths now, so the URL a tab prefetches is the URL
  // the tap pushes: the tab's loading.tsx (its placeholder) is already in
  // the router cache, and a tab you came from is cached whole (staleTimes in
  // next.config.ts). Until then the proxy rewrote /web/... onto a bare tree,
  // every prefetch missed, and the old screen stood for the round trip.
  //
  // The tapped tab lights AT ONCE and its placeholder paints over the old
  // screen (PendingScreen), both on finger-down: usePathname only moves when
  // the new screen commits (MESITA-2762, MESITA-2846).
  const pending = usePendingTab(pathname);
  // THE BAR NAVIGATES ON FINGER-DOWN, NOT ON CLICK (MESITA-2837, 2846): the
  // push leaves with the touch itself, the earliest moment there is. The
  // pointer click that follows is swallowed here so it does not push twice;
  // a keyboard click (no pointerdown before it) still navigates through
  // Link. A lost pointerup is harmless: the push already left.
  const pushedByPointer = useRef(false);
  return (
    <nav
      // The screen slide keeps the bar still by this hook (globals.css).
      data-shell-nav=""
      // The place screen, as a page or a panel, owns the whole frame
      // (MESITA-3300), and so do Reserve and the generating screen: the
      // route map says where the bar shows (MESITA-3646).
      hidden={!barShowsOn(pathname)}
      className={cn(
        "border-border bg-card/95 pointer-events-auto relative shrink-0 border-t px-0.5 pt-2 backdrop-blur",
        Z_BOTTOM_NAV,
      )}
    >
      <div className="flex items-end justify-around">
        {ITEMS.map((item) => {
          const { Icon, label } = item;
          const active = pending
            ? pending === item.href
            : tabFor(pathname) === item.tab;
          const className = cn(
            "type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition",
            active
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          );
          const body = (
            <>
              {active && (
                <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
              )}
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                  active && "bg-primary/10 ring-primary/20 ring-1",
                )}
              >
                {item.href === CONSUMER_ROUTES.me && avatarUrl ? (
                  <SizedImg
                    src={avatarUrl}
                    size="thumb"
                    alt=""
                    className={cn(
                      "h-6 w-6 rounded-full object-cover",
                      active && "ring-primary ring-2",
                    )}
                    data-me-tab-avatar
                  />
                ) : (
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                )}
                {item.tab === "me" && unseen ? (
                  <span
                    className="bg-destructive ring-card absolute top-0 right-0 h-2.5 w-2.5 rounded-full ring-2"
                    data-unseen-dot
                  >
                    <span className="sr-only">New notifications</span>
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-center">{label}</span>
            </>
          );
          // The tab you are on does nothing: no push, no light, no load.
          const here = pathname === item.href;
          const down = (event: PointerEvent) => {
            if (event.button !== 0) return;
            pushedByPointer.current = true;
            if (!here && pending !== item.href) {
              setPendingTab(item.href, pathname);
              router.push(item.href);
            }
            // Analytics leaves after the navigation request, never before it.
            window.setTimeout(
              () => trackEvent(getSupabase(), "nav_tab_tap", { tab: label }),
              0,
            );
          };
          const click = (event: MouseEvent) => {
            // detail is 0 for a keyboard click: let Link navigate.
            if (pushedByPointer.current && event.detail > 0) {
              event.preventDefault();
            }
            pushedByPointer.current = false;
            if (here) event.preventDefault();
          };
          return (
            <Link
              key={item.href}
              href={item.href}
              onPointerDown={down}
              onClick={click}
              className={className}
            >
              {body}
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}

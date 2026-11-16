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
import { QrCode, Search, User } from "lucide-react";
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
import { CountBubble } from "./CountBubble";
import { useUnseenNotificationCount } from "./use-unseen-notifications";

// FOUR TABS, in this order (Pato, 2026-11-16, MESITA-4199: "merge pay and
// wallet into one page ... call that page Pay"):
//
//   Home · Search · Pay · Me
//
// WALLET IS PAY'S LOWER HALF: it held its own slot from MESITA-3722 and again
// from MESITA-3886 (Share held it MESITA-3855/3867 between); /wallet now
// forwards to /pay, and Share Mesita is one of Pay's four buttons.
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
//   PAY LIGHTS ON EVERY ADDRESS UNDER /pay (/pay/place/<placeId>, /pay/bill/<id>,
//   /pay/receipt/<id>), and on the Wallet's House Cards, gift links, Buy,
//   Send, Claim, Add a card and /share (MESITA-4199).
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
    href: CONSUMER_ROUTES.me,
    Icon: User,
    label: "Me",
    tab: "me",
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const avatarUrl = useConsumerProfile().data?.avatar_url ?? null;
  const unseen = useUnseenNotificationCount();
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
          // THE LIT TAB IS UNMISTAKABLE (Pato, MESITA-3921: "the bottom menu
          // selected item must have a way more contrast. its too weak"): a
          // solid ink circle with a paper icon, a semibold ink label and a
          // 4px bar on top. It wore a 10% tint and a 20% ring until then.
          const className = cn(
            "type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition",
            active
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground font-medium",
          );
          const body = (
            <>
              {active && (
                <span className="bg-primary absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full" />
              )}
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                  active && "bg-primary text-primary-foreground",
                )}
              >
                {item.href === CONSUMER_ROUTES.me && avatarUrl ? (
                  <SizedImg
                    src={avatarUrl}
                    size="thumb"
                    alt=""
                    className={cn(
                      "h-6 w-6 rounded-full object-cover",
                      active && "ring-primary-foreground ring-2",
                    )}
                    data-me-tab-avatar
                  />
                ) : (
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                )}
                {/* THE SAME BUBBLE AS ME'S BOXES (MESITA-3996): 20px, the
                    unseen count in it; a 10px dot until then. */}
                {item.tab === "me" && unseen ? (
                  <span className="absolute -top-1.5 -right-3" data-unseen-dot>
                    <CountBubble count={unseen} className="ring-card ring-2" />
                    <span className="sr-only">{unseen} new notifications</span>
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

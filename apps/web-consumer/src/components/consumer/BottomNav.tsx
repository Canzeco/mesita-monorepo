"use client";

import { Z_BOTTOM_NAV } from "@/lib/z-index";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { QrCode, Inbox, User } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { ComingSoonModal } from "./ComingSoonModal";
import { cn } from "@/lib/utils";
import {
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
} from "@/lib/consumer-route-contract";

// FOUR top-level surfaces: Discover, Pay, Activity, Me (2026-09-01, was five).
//
// Home and Search merged into Discover, and the merge was a DELETION: Home had
// been Soon since 2026-08-28 — all five of its modes opened coming-soon
// dialogs — while Search shipped the live map, filters, catalog rail and deep
// search. So the dead tab was the leftmost one, it wore the brand mark, and it
// was the most probable first tap a new guest ever made. Discover is Search,
// unmoved, under a name that survives the parked modes shipping later.
//
// At four items each column is ~94px at 375px (was ~75px), which is why the
// active underline is w-6 rather than w-5 — a 20px rule under a 94px column
// reads thin.
//
// Every tab shows its plain label. Me used to append the live class ("Me ·
// Standard") — dropped 2026-08-16 (Pato: "only write me, its cleaner"). A tab
// label names a DESTINATION; the class is status, and status belongs on the Me
// page where it can be read and acted on, not stamped into the chrome of every
// screen. MESITA-1119's mockup (Agents tab + class-suffixed Me) is superseded
// by Product Rules §C; `route-structure.test.tsx` pins the five plain labels.

// Every icon is a lucide glyph now (the brand mark left with the Home tab).
// The signature stays wider than LucideIcon so a future non-lucide glyph does
// not force a type change at every call site.
type Item = {
  href: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  /**
   * Every pathname prefix that lights this tab. A LIST, not one-plus-a-spare:
   * the previous shape was one required prefix plus one optional spare, Activity
   * had already spent the spare on /reservation, and a third prefix (Home's
   * /place) was hard-coded as a special case down in the render. Three ways to
   * say one thing meant a tab could silently light NOTHING — which is exactly
   * what happens to a detail route that stops nesting under its tab's prefix.
   *
   * Order is irrelevant; matching is `startsWith` over the whole list.
   */
  matchPrefixes: readonly string[];
  // Surface is parked. Tab stays visible and tappable; tap opens
  // ComingSoonModal instead of navigating (MESITA-383 — no "Soon" pills).
  soon?: boolean;
  soonTitle?: string;
  soonBody?: string;
};

const ITEMS: Item[] = [
  {
    // Discover IS the map. No sub-route, no mode row, no redirect hop — the
    // href is the live surface itself (2026-09-01, retiring /home).
    href: CONSUMER_ROUTES.discoverDefault,
    // The brand mark (Pato, 2026-09-01), reversing the magnifier this tab
    // shipped with hours earlier. The magnifier was chosen because Discover
    // WAS the map and would otherwise lose its only recognisable affordance —
    // that argument expired the moment Discover grew a seven-mode rail whose
    // first two pills carry their own pin and magnifier glyphs. The tab names
    // a place to go, and the mark is what says which product you are in.
    Icon: MesitaMark,
    label: "Discover",
    // /place rode the Home entry before the retirement and has no other
    // consumer, so it moves here. Drop it and place detail lights NOTHING —
    // route-structure T5's cardinality assertion is what catches that.
    matchPrefixes: [
      CONSUMER_ROUTE_PREFIX.discover,
      CONSUMER_ROUTE_PREFIX.place,
    ],
  },
  {
    href: CONSUMER_ROUTES.newVisit.root,
    // QR is the right glyph and stays: showing the QR IS the visit.
    Icon: QrCode,
    // "Pay" (Pato, 2026-08-17), reversing the 2026-08-16 call for "Visit".
    // The tab is named for what the guest came to DO — the QR they show is the
    // moment they pay — rather than for the object it creates.
    //
    // THE LABEL MOVED, AND NOTHING ELSE. The route is still /new-visit, the
    // detail is still /visit/{id} and the object is still a visit ticket. This
    // tab has now been called Rewards, Pay, Visit and Pay again; every one of
    // those renames stayed in the label, which is why the URLs and the schema
    // survived four of them.
    //
    // "Pay" no longer collides with Stripe: `checkout` is the word for Stripe
    // in this codebase, and the one Stripe surface a consumer can reach says
    // "Continue to checkout" (PlanModal). Paying a BILL and checking out of a
    // SUBSCRIPTION stay two different words.
    label: "Pay",
    matchPrefixes: [CONSUMER_ROUTE_PREFIX.newVisit],
    // LIVE — the pass (QR + code + what you can claim + live visit) and the
    // ticket stack are built; the tab opens the real page.
  },
  {
    href: CONSUMER_ROUTES.inboxDefault,
    // An inbox tray, not a calendar. CalendarCheck named RESERVATIONS — fine
    // when the tab was the reservations surface wearing a container's name,
    // wrong now that the container actually holds four things and a booking
    // is only one of them (Pato, 2026-08-16).
    Icon: Inbox,
    // "Activity" is the container, not the function (Pato, 2026-08-15; renamed
    // from Inbox 2026-08-31): it holds Wallet · Visits · Orders · Reservations
    // · Notifications, so it can't be named after any one of them, and naming
    // it for the mechanism ("Agent") would break the day places integrate
    // directly. Inbox named a place things ARRIVE at — never true of the money
    // section, and visibly false now that Wallet leads the row.
    //
    // ROUTE UNCHANGED — /inbox, the same rule Bookings and Alerts follow. The
    // tray GLYPH also stays: it is brand chrome, a swap was not asked for, and
    // "Activity" has no unambiguous lucide glyph (lucide's own `Activity` is a
    // heartbeat line that reads as analytics). Worth a design pass, not a
    // silent change.
    label: "Activity",
    // /inbox for the sections, plus the two DETAIL routes that deliberately
    // live outside the tab's namespace because you reach each from two places.
    // Both lists live under Activity, so both details light Activity:
    //   /visit/{id}       reached from the centre tab AND Activity > Visits
    //   /reservation/{id} reached from a place AND Activity > Bookings
    matchPrefixes: [
      CONSUMER_ROUTE_PREFIX.inbox,
      CONSUMER_ROUTE_PREFIX.visit,
      CONSUMER_RESERVATION_SURFACE_PREFIX,
    ],
  },
  {
    href: CONSUMER_ROUTES.me,
    Icon: User,
    label: "Me",
    matchPrefixes: [CONSUMER_ROUTE_PREFIX.me],
  },
];

export function BottomNav({ userId }: { userId?: string }) {
  // The inbox tab (and its pending-notification badge) left the tab bar when
  // Home/Search took over discovery; the prop stays so the shell layout call
  // site doesn't churn while other agents work this tree.
  void userId;
  const pathname = usePathname();
  const [soonItem, setSoonItem] = useState<Item | null>(null);

  return (
    <>
      <nav
        // Hook for surfaces that own their whole frame and suppress the tab
        // bar in CSS (place detail — see PlaceDetailPageBody). A data attribute
        // rather than a route list here: whether the nav belongs on a screen is
        // that screen's statement, and the pathname alone can't tell the
        // hard-nav place PAGE from the intercepted place MODAL, which share it.
        data-shell-nav=""
        className={cn(
          "border-border bg-card/95 shrink-0 border-t px-0.5 pt-2 backdrop-blur",
          Z_BOTTOM_NAV,
        )}
      >
        <div className="flex items-end justify-around">
          {ITEMS.map((item) => {
            const { href, Icon, label, matchPrefixes, soon } = item;
            const active = matchPrefixes.some((p) => pathname.startsWith(p));
            // Parked surfaces stay tappable — open ComingSoonModal (no Soon pill).
            if (soon) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => setSoonItem(item)}
                  aria-haspopup="dialog"
                  title={item.soonTitle ?? "Coming soon"}
                  className="text-muted-foreground hover:text-foreground type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition"
                >
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="w-full truncate text-center">{label}</span>
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
                )}

                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                    active && "bg-primary/10 ring-primary/20 ring-1",
                  )}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                <span className="w-full truncate text-center">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
      </nav>
      <ComingSoonModal
        open={soonItem != null}
        onClose={() => setSoonItem(null)}
        title={soonItem?.soonTitle ?? "Coming soon"}
        body={soonItem?.soonBody}
        // Item.Icon is deliberately wider than LucideIcon (Home renders the
        // brand mark), so it can't be forwarded here. No tab is parked today;
        // when one is, give it a real lucide glyph rather than widening the
        // modal's prop.
        icon={QrCode}
      />
    </>
  );
}

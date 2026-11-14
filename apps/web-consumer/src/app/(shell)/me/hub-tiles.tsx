import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, type ReactNode } from "react";
import {
  Bell,
  CalendarCheck,
  CreditCard,
  Crown,
  Settings as SettingsIcon,
  Ticket,
  UserRound,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid, type DestShape } from "./profile-sections";

// ─── Me's ten cells and the page they sit on ─────────────────────────────────
//
// ONE SOURCE FOR THE HUB (Pato, MESITA-2701: "the placeholders must be
// similar to the page you are loading, like the sizes"). ProfileClient draws
// these cells as DestTiles; (hub)/loading.tsx draws the same cells as
// DestTileSkeletons in the same shapes, printing their words as themselves,
// so nothing jumps when the page lands. The cells, their order, the grid and
// the scroller are written once, here.
//
// THREE UP (Pato, MESITA-3450: "Here in Me do 3 columns for boxes instead of
// 2"). Nine cells fill a 3×3 grid, each one an icon over its title; a third
// of a phone is too narrow for the chip beside the words. Settings is the
// tenth: a full-width row under the grid, in the old row shape, so no cell
// sits alone on a fourth row.
//
// A PLAIN MODULE, NOT A CLIENT ONE: (hub)/loading.tsx is a server component
// and reads these cells directly. It never hands an Icon to a client
// component (a function cannot cross that line, MESITA-2129); it passes the
// words only.
//
// The order is Pato's (MESITA-2562; Support left for Settings, MESITA-2169),
// read left to right in threes since MESITA-3450:
//
//   Profile · Instagram · Class
//   Plan · Notifications · Reservations
//   Favorites · Connector · Share
//   Settings                      (full width)
//
// Share left the bar (MESITA-2871) and came here (MESITA-2887).
//
// TWELVE CELLS, A FULL 3×4 SINCE MESITA-3465 (Pato: "this looks like shit.
// add two other boxes, maybe some for transactions ... or the other 2 boxes
// as pending ... invent something"): Transactions (every money line, real)
// and Cards (saved ways to pay, Soon) sit after Favorites, and Settings is
// the twelfth cell, no longer a full-width row under the grid:
//
//   Profile · Instagram · Class
//   Plan · Notifications · Reservations
//   Favorites · Transactions · Cards
//   Connector · Share · Settings
//
// THIRTEEN SINCE MESITA-3517: Refunds sits after Cards, the money cells
// together, and Settings closes the page across both columns, so no cell
// sits alone on the last row (two columns since MESITA-3469):
//
//   Profile · Instagram / Class · Plan / Notifications · Reservations /
//   Favorites · Transactions / Cards · Refunds / Connector · Share /
//   Settings (full width)
//
// NINE SINCE MESITA-3855 (Pato, 2026-11-14: "Home Search Pay Share Me";
// "Profile Instagram / Class Plan(Soon) / Notifications, Reservations /
// Gift, Share / Tickets, Settings"): Activity left the bar, so its
// Notifications, Reservations and Tickets are Me's pages; Share went to the
// bar as a button, so Settings closes the grid alone at the left:
//
//   Profile · Instagram / Class · Plan (Soon) /
//   Notifications · Reservations / Gift · Tickets /
//   Settings
//
// route-structure T8 pins them.
//
// NO TILE PRINTS A GUEST FACT (Pato, MESITA-2607: "in the boxes below don't
// display anything of info of the user ... don't display info
// preliminarily"). The header card holds the four facts; every summary is a
// static description of what its page holds.

/** One cell: a destination, a route to `/me/<box>`. */
export type HubTile = {
  Icon: LucideIcon;
  title: string;
  /** THREE WORDS OR FEWER (profile-sections.tsx). */
  summary: string;
  href: string;
  /** Opens nothing yet: a Soon pill, no link (Plan, MESITA-3855). */
  soon?: boolean;
};

/** The grid cells, in reading order; Settings is the last (nine with it
 *  since MESITA-3855: Profile · Instagram / Class · Plan / Notifications ·
 *  Reservations / Gift · Tickets / Settings). */
export const ME_HUB_GRID: readonly HubTile[] = [
  // PROFILE LEADS (Pato, 2026-09-08), INSTAGRAM BESIDE IT (MESITA-2080). The
  // member number is on /me/profile, with its copy button; the tile only
  // names the page (MESITA-2607).
  {
    Icon: UserRound,
    title: "Profile",
    summary: "Name and photo",
    href: CONSUMER_ROUTES.mePages.profile,
  },
  {
    Icon: Instagram,
    title: "Instagram",
    summary: "Connect your account",
    href: CONSUMER_ROUTES.mePages.instagram,
  },
  // CLASS BESIDE PLAN (Pato, MESITA-2562): two separate facts (MESITA-2553),
  // each a page. Never the gem on Plan: that shape was the old class chip
  // (MESITA-2551). The summary names the two values each page explains,
  // never the guest's own (MESITA-2607). Class is joinable again (MESITA-3054;
  // it read "Soon" under MESITA-3027).
  {
    Icon: Crown,
    title: "Class",
    summary: "Regular or VIP",
    href: CONSUMER_ROUTES.mePages.class,
  },
  // PLAN IS SOON (Pato, 2026-11-14, MESITA-3855: "Move plan to settings for
  // the moment … Class Plan(Soon)"): the cell holds its place and opens
  // nothing; the page is Settings › Plan.
  {
    Icon: CreditCard,
    title: "Plan",
    summary: "Free or Pro",
    href: CONSUMER_ROUTES.mePages.plan,
    soon: true,
  },
  // ACTIVITY'S CHIPS, AS ME'S PAGES (MESITA-3855). The Notifications cell
  // wears the red dot the bar's Activity tab wore (MESITA-3717).
  {
    Icon: Bell,
    title: "Notifications",
    summary: "Bookings and updates",
    href: CONSUMER_ROUTES.mePages.notifications,
  },
  {
    Icon: CalendarCheck,
    title: "Reservations",
    summary: "Upcoming and past",
    href: CONSUMER_ROUTES.mePages.reservations,
  },
  // GIFT (MESITA-3771): gift credit you hold at a place to a friend.
  {
    Icon: Gift,
    title: "Gift",
    summary: "Send credit to a friend",
    href: CONSUMER_ROUTES.mePages.gift,
  },
  // TICKETS: every transaction, four kinds — Visit, Voucher, Gift, Refund.
  {
    Icon: Ticket,
    title: "Tickets",
    summary: "Every transaction",
    href: CONSUMER_ROUTES.mePages.tickets,
  },
];

/** The last cell: Settings closes the grid (MESITA-2562); a full-width row
 *  under it until MESITA-3465. */
export const ME_HUB_SETTINGS: HubTile = {
  Icon: SettingsIcon,
  title: "Settings",
  summary: "Language, account",
  href: CONSUMER_ROUTES.mePages.settings,
};

/** The hub: the app bar fixed above by flex, then the grid and the Settings
 *  row in their scroller — px-4 on the tiles' 16px edge, pt-3 so the header
 *  card sits one gap (12px) above the tiles. `tile` draws one cell in its
 *  shape: ProfileClient's DestTile, or the fallback's DestTileSkeleton.
 *  `children` lands after the tiles (the fallback's status line). */
export function MeHubFrame({
  bar,
  tile,
  children,
}: {
  bar: ReactNode;
  tile: (cell: HubTile, shape: DestShape) => ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      {bar}
      <KeptScroll className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-3 pb-8">
        <div className="flex flex-col gap-2">
          <DestGrid>
            {ME_HUB_GRID.map((cell) => (
              <Fragment key={cell.href}>{tile(cell, "cell")}</Fragment>
            ))}
            {/* SETTINGS AT THE LEFT, NOTHING AT THE RIGHT (MESITA-3527, Pato:
                "if it's uneven the number of items, then asymmetry is okay"). */}
            {tile(ME_HUB_SETTINGS, "cell")}
          </DestGrid>
        </div>
      </KeptScroll>
      {children}
    </div>
  );
}

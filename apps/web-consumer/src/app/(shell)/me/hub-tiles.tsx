import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, type ReactNode } from "react";
import {
  Bell,
  CalendarCheck,
  CreditCard,
  Gem,
  Gift,
  Heart,
  Settings as SettingsIcon,
  Ticket,
  UserRound,
  Share2,
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
// NINE SINCE MESITA-3855 (Pato, 2026-11-14: "Home Search Pay Share Me"):
// Activity left the bar, so its Notifications, Reservations and Tickets are
// Me's pages; Share went to the bar, so Settings closed the grid alone.
//
// ELEVEN SINCE MESITA-3867 (Pato, 2026-11-14: "share also here even if
// redundant i don't care"; then "add MCP here with soon, before settings"):
// a Share cell, a jump to the bar's Share tab (/share), and MCP back as a
// Soon cell (it left Me under MESITA-3771), then Settings alone at the left:
//
//   Profile · Instagram / Class · Plan /
//   Notifications · Reservations / Gift · Tickets /
//   Share · MCP (Soon) / Settings
//
// TEN SINCE MESITA-3880 (Pato, 2026-11-14: "remove share button from here
// is redundant"): the Share cell left, the bar's Share tab stays, and MCP
// and Settings share the last row:
//
//   Profile · Instagram / Class · Plan /
//   Notifications · Reservations / Gift · Tickets /
//   MCP (Soon) · Settings
//
// Then Tickets before Gift (MESITA-3885), and the boxes show their state:
// see DestTile's TileState and ProfileClient.
//
// SHARE REPLACES GIFT (MESITA-3940, Pato: "here add share instead of gift"):
//
//   Profile · Instagram / Class · Plan /
//   Notifications · Reservations / Tickets · Share /
//   MCP (Soon) · Settings
//
// CLASS LEFT (MESITA-4306, Pato, 2026-11-17: "LETS REMOVE THE CLASS. MAYBE
// WE CAN RETURN THEM IN THE FUTURE"): nine cells, Settings closing them:
//
//   Profile · Instagram / Plan · Notifications /
//   Reservations · Tickets / Share · Integrations /
//   Settings
//
// GIFT ACROSS BOTH COLUMNS (MESITA-4420, Pato, 2026-11-18: "add gift being
// double size / two colums for gift"): /me/gift is back on Me as a
// full-width row (chip beside title and summary). It led the grid, then
// closes the page under Settings (MESITA-4424: "Gift must be at the
// bottom"). Share stays:
//
//   Profile · Instagram / Plan · Saved / Notifications · Reservations /
//   Tickets · Share / Integrations · Settings /
//   Gift (full width)
//
// CLASS BACK, INTEGRATIONS INTO SETTINGS (MESITA-4657, Pato 2026-11-22):
//
//   Profile · Instagram / Class · Plan / Notifications · Reservations /
//   Saved · Tickets / Share · Settings
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

/** The grid cells, in reading order; Settings is the last (ten with it
 *  since MESITA-4329: Profile · Instagram / Plan · Saved / Notifications ·
 *  Reservations / Tickets · Share / Integrations · Settings). */
export const ME_HUB_GRID: readonly HubTile[] = [
  // PROFILE LEADS (Pato, 2026-09-08), INSTAGRAM BESIDE IT (MESITA-2080). The
  // tile only names the page (MESITA-2607).
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
  // NO CLASS (Pato, 2026-11-22, MESITA-4709: "no more VIP"): the Class
  // tile and /me/class left again (back with MESITA-4657, first gone with
  // MESITA-4306).
  // PLAN IS SOLD AGAIN (Pato, 2026-11-14, MESITA-3870: "Add the Plan
  // again"): the cell opens /me/plan — Free 3 reservation tickets a month, Pro 10
  // at $2 a month. It read Soon under MESITA-3855.
  {
    // A GEM, NOT A CARD (MESITA-4706: "Plan use other thing to represent
    // plan so it doesn't conflict"): the card is Cards' now.
    Icon: Gem,
    title: "Plan",
    summary: "Free or Pro",
    href: CONSUMER_ROUTES.mePages.plan,
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
  // SAVED, A SHORTCUT (after Reservations since MESITA-4657) (Pato, 2026-11-18, MESITA-4327: "add a new box, a
  // shortcut for saved places. not own place. just a shortcut"): Home on
  // its ❤️ Saved row, no page of its own. Right after Plan (MESITA-4329:
  // "put it after plan"); it sat beside Settings first.
  {
    Icon: Heart,
    title: "Saved",
    summary: "Places you saved",
    href: `${CONSUMER_ROUTES.home}?row=saved`,
  },
  // TICKETS BEFORE GIFT (MESITA-3885, Pato: "tickets before gift").
  // Every transaction, four kinds — Visit, Voucher, Gift, Refund.
  {
    Icon: Ticket,
    title: "Tickets",
    summary: "Every transaction",
    href: CONSUMER_ROUTES.mePages.tickets,
  },
  // SHARE REPLACES GIFT (Pato, 2026-11-14, MESITA-3940: "here add share
  // instead of gift"): the cell opens /share, the channel-rows page Wallet
  // opens too (MESITA-3886). /me/gift stays a live address; gifting credit
  // lives on a place's Loyalty Card in Wallet.
  {
    Icon: Share2,
    title: "Share",
    summary: "Tell a friend",
    href: CONSUMER_ROUTES.share,
  },
  // GIFT IS BACK ON ME (Pato, 2026-11-22, MESITA-4670: "Add Gift button
  // here too"): beside Share, both about other people; it opens Send Gift's
  // place list, the Loyalty Card's Send Gift flow. Gone since MESITA-4523.
  {
    Icon: Gift,
    title: "Gift",
    summary: "Send credit",
    href: CONSUMER_ROUTES.walletSend,
  },
  // CARDS (Pato, 2026-11-22, MESITA-4698: "move card to this part. Cards.
  // remove payment method from pay page"): the saved card, Apple Pay and
  // Google Pay (/wallet/methods), which buy vouchers; a bill is paid outside
  // since card bill pay left. It sits beside Settings on the last row.
  {
    // AN ACTUAL CARD (MESITA-4706: "card must be an actual card").
    Icon: CreditCard,
    title: "Cards",
    summary: "Ways to pay",
    href: CONSUMER_ROUTES.walletMethods,
  },
  // NO INTEGRATIONS CELL (Pato, 2026-11-22, MESITA-4657: "Share Settings
  // (integrations here inside)"): it is Settings' first row.
];

/** The last cell: Settings closes the grid (MESITA-2562); a full-width row
 *  under it until MESITA-3465. */
export const ME_HUB_SETTINGS: HubTile = {
  Icon: SettingsIcon,
  title: "Settings",
  summary: "Language, account",
  href: CONSUMER_ROUTES.mePages.settings,
};

// NO GIFT BOX (Pato, 2026-11-21, MESITA-4523: "remove gift from here"):
// Send Gift is a black button on Pay (MESITA-4520). MESITA-4420 to 4476
// had a full-width Gift box under Settings that opened Pay.

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
      {/* THE HEADER IS THE FIRST CARD (Pato, MESITA-4313, picked A): it
          scrolls with the tiles, on their 16px edge, 12px above the grid. */}
      <KeptScroll className="scrollbar-thin-dark flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <div className="flex flex-col gap-3">
          {bar}
          <DestGrid>
            {ME_HUB_GRID.map((cell) => (
              <Fragment key={cell.title}>{tile(cell, "cell")}</Fragment>
            ))}
            {/* SETTINGS CLOSES THE GRID, one cell like the rest, alone in the
                last row (Pato, 2026-11-22, MESITA-4673: "settings same size
                even if asymmetric"); it spanned both columns for one deploy
                (MESITA-4670). */}
            {tile(ME_HUB_SETTINGS, "cell")}
          </DestGrid>
        </div>
      </KeptScroll>
      {children}
    </div>
  );
}

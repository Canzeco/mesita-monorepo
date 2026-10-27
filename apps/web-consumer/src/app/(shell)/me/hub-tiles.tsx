import { Fragment, type ReactNode } from "react";
import {
  Bell,
  CalendarCheck,
  CreditCard,
  Crown,
  Heart,
  Plug,
  Settings as SettingsIcon,
  Share2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid } from "./profile-sections";

// ─── Me's ten cells and the page they sit on ──────────────────────────────
//
// ONE SOURCE FOR THE HUB (Pato, MESITA-2701: "the placeholders must be
// similar to the page you are loading, like the sizes"). ProfileClient draws
// these rows as DestTiles; (hub)/loading.tsx draws the same rows as
// DestTileSkeletons, which print each title and summary as themselves. A
// tile's text column is under 100px on a phone, so most summaries wrap to
// two lines there, and a one-line bar drew every row short: the grid jumped
// when the page landed. The cells, their order, their rows and the scroller
// are written once, here.
//
// A PLAIN MODULE, NOT A CLIENT ONE: (hub)/loading.tsx is a server component
// and reads these rows directly. It never hands an Icon to a client
// component (a function cannot cross that line, MESITA-2129); it passes the
// words only.
//
// The order is Pato's (MESITA-2562; Support left for Settings, MESITA-2169):
//
//   2              Profile · Instagram
//   2              Class · Plan
//   2              Notifications · Reservations
//   2              Favorites · Connector
//   2              Share · Settings
//
// Share left the bar (MESITA-2871) and came here (MESITA-2887, Pato: "Add
// the Sharee button here"); it fills the cell beside Settings.
//
// TEN CELLS, AND THAT IS THE WHOLE PAGE. route-structure T8 pins them.
//
// NO TILE PRINTS A GUEST FACT (Pato, MESITA-2607: "in the boxes below don't
// display anything of info of the user ... don't display info
// preliminarily"). The header card holds the four facts; every summary is a
// static description of what its page holds.

/** One cell: a destination, a route to `/me/<box>` — or `/share`, the one
 *  page Me opens outside its own namespace (MESITA-2887). */
export type HubTile = {
  Icon: LucideIcon;
  title: string;
  /** THREE WORDS OR FEWER (profile-sections.tsx). */
  summary: string;
  href: string;
};

export const ME_HUB_ROWS: readonly (readonly HubTile[])[] = [
  // PROFILE LEADS (Pato, 2026-09-08), INSTAGRAM BESIDE IT (MESITA-2080). The
  // member number is on /me/profile, with its copy button; the tile only
  // names the page (MESITA-2607).
  [
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
  ],
  // CLASS BESIDE PLAN (Pato, MESITA-2562): two separate facts (MESITA-2553),
  // each a page. Never the gem on Plan: that shape was the old class chip
  // (MESITA-2551). The summary names the two values each page explains,
  // never the guest's own (MESITA-2607).
  [
    {
      Icon: Crown,
      title: "Class",
      summary: "Regular or VIP",
      href: CONSUMER_ROUTES.mePages.class,
    },
    {
      Icon: CreditCard,
      title: "Plan",
      summary: "Free or Premium",
      href: CONSUMER_ROUTES.mePages.plan,
    },
  ],
  [
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
  ],
  // Favorites and Reservations are each their own page (MESITA-2565); they
  // were the two tabs of Saved (MESITA-2561). Connector is Mesita in an AI
  // assistant; it is not built, so its page says Soon (MESITA-2562).
  [
    {
      Icon: Heart,
      title: "Favorites",
      summary: "Places you saved",
      href: CONSUMER_ROUTES.mePages.favorites,
    },
    {
      Icon: Plug,
      title: "Connector",
      summary: "ChatGPT or Claude",
      href: CONSUMER_ROUTES.mePages.connector,
    },
  ],
  // Settings closes the page (Pato, MESITA-2562); Share sits beside it, the
  // three joined dots it wore on the bar (MESITA-2568, MESITA-2887).
  [
    {
      Icon: Share2,
      title: "Share",
      summary: "Invite your friends",
      href: CONSUMER_ROUTES.share,
    },
    {
      Icon: SettingsIcon,
      title: "Settings",
      summary: "Language, account",
      href: CONSUMER_ROUTES.mePages.settings,
    },
  ],
];

/** The hub: the app bar fixed above by flex, then the rows in their
 *  scroller — px-4 on the tiles' 16px edge, pt-3 so the header card sits
 *  one row-gap (12px) above the tiles, 12px between rows. `tile` draws one
 *  cell: ProfileClient's DestTile, or the fallback's DestTileSkeleton.
 *  `children` lands after the rows (the fallback's status line). */
export function MeHubFrame({
  bar,
  tile,
  children,
}: {
  bar: ReactNode;
  tile: (cell: HubTile) => ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      {bar}
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-3 pb-8">
        <div className="flex flex-col gap-3">
          {ME_HUB_ROWS.map((row) => (
            <DestGrid key={row[0].href}>
              {row.map((cell) => (
                <Fragment key={cell.href}>{tile(cell)}</Fragment>
              ))}
            </DestGrid>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

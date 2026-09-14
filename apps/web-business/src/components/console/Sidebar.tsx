"use client";

// The whole navigation: one lateral rail, TWO LEVELS (MESITA-1841).
//
// Pato, 2026-09-14, a drawing of nine rows on two levels:
//
//   Organization / Payments / Credits / Activity / Place(s) →
//     Profile / Reviews / Capabilities / Rewards / Admin
//
//   [ ▣ Organization ]  → /orgs/<id>/organization   who is in it, what it holds
//   [ ▤ Payments     ]  → /orgs/<id>/payments       Stripe · Partner
//   [ ◎ Credits      ]  → /orgs/<id>/credits        prepaid, and its liability
//   [ ▥ Activity     ]  → /orgs/<id>/activity       the numbers, by place
//   ─ <the place's name> ────
//     [ ⌂ Profile      ]  → /places/<id>/profile
//     [ ★ Reviews      ]  → /places/<id>/reviews
//     [ ⇄ Capabilities ]  → /places/<id>/capabilities   what a guest CAN do
//     [ ⛁ Rewards      ]  → /places/<id>/rewards        what a guest EARNS
//     [ ⛨ Admin        ]  → /places/<id>/admin          super-admin only
//   ─────
//   ○ Account          the person, and the two switchers
//   ◧ Collapse         the rail's own control
//
// WHY A GROUP AND NOT SEVEN PEERS. The console has exactly two subjects. Six
// flat peers (MESITA-1832) made an operator read every label to find out which
// subject a row was about, and the labels cannot carry that: "Payments" and
// "Profile" look like siblings and are not — one is the company's money, the
// other is one storefront's page. The indent says it in one glance, and the
// addresses already said it (`/orgs/<id>/…` vs `/places/<id>/…`).
//
// THE GROUP HEADER IS A LABEL, NOT A SWITCHER. MESITA-1822 took the two
// switchers out of the rail on purpose and put them on Account; this does not
// put one back. The header prints the SELECTED PLACE's name, which is the one
// fact the five rows beneath it depend on and the only thing the old flat rail
// could not say — "Profile" alone never told you whose.
//
// NO ID IN ANY ADDRESS THE OPERATOR READS. Every href carries one; none is
// ever shown. A one-place owner meets no id, no switcher, and no chevron.
// Exactly ONE filled pill, always.
//
// ACCOUNT IS THE LAST ROW, not row one. It is not one of the two subjects —
// it is the person — and Pato's drawing leaves it off the numbered list
// entirely. It keeps a row because nothing else reaches you, sign-out, or the
// two switchers, and it stays INSIDE the nav landmark below a seam: a link
// parked outside `<nav>` for visual reasons is a link a screen reader's
// landmark list loses. Members and Places have addresses and no row of their
// own: the Organization page is their door, and they light ITS row.
//
// NO PLACE YET: the five place rows stay, AT FULL STRENGTH (MESITA-1833); each
// opens the page, which answers with the one next step. The rail never
// shrinks. Zero organizations: Account and Create organization. A failed
// organizations read: Account and a muted line, never the create row
// (MESITA-1793's law).
//
// THEY USED TO BE DIMMED, and the dimming was a lie. `opacity-60` plus a
// "Profile · add a place first" tooltip painted five of seven rows as
// disabled — while every one of them was a live link landing on NoPlaceYet,
// which is a real next step, not a dead end. With zero places in the
// catalogue that is the state EVERY account is in, so the first thing a new
// operator met was a console that looked broken. Pato, 2026-09-14: "make all
// this functional. not hidden shit." A disabled look belongs to a control
// that does nothing; these do something.
//
// ONE INDENT, UNDER ONE HEADER, AND NOTHING ELSE. The flat law
// (MESITA-1832) is narrowed, not deleted: `shell-chrome.test.ts` still refuses
// a tree line, a bullet, a box, an eyebrow above the organization rows, and a
// second seam. `RAIL_INDENT` is the one sanctioned inset and it is written
// once — a second literal `pl-` in this file is the failure the test watches
// for.
//
// DARK (MESITA-1831). The rail sits on the brand's ink (`--sidebar` is the
// dock token, globals.css) and paints ONLY with `sidebar-*` tokens: rows at
// rest `text-sidebar-muted` (58% white), hover `bg-sidebar-accent` (white/10)
// + full white, the pill an off-white fill with ink text. A page token —
// `text-muted-foreground`, `bg-foreground` — is ink on ink here, and the
// source test refuses it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Building2,
  ChartNoAxesColumn,
  Coins,
  Gift,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Shield,
  SlidersHorizontal,
  Star,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { useOpenPlace, useOpenPlaceGuard, type GuardNav } from "@/components/console/OpenPlace";
import {
  FLAT_ROUTES,
  ORG_RAIL_PAGES,
  SHELL_ROUTES,
  flatOrgPageFromPathname,
  flatViewFromPathname,
  orgHref,
  orgPageFromPathname,
  type OrgRailPage,
} from "@/lib/console-routes";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  tabsForAccess,
  type PlaceTab,
} from "@/lib/place-tabs";
import type { RailOrg, RailScope } from "@/lib/rail-scope";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";

type SidebarProps = {
  scope: RailScope;
  organizations: readonly RailOrg[];
  isSuperAdmin: boolean;
  /** The organizations could not be read. NOT the zero state: a fetch
   *  failure must never read "create one" (MESITA-1793's law). */
  viewerError: boolean;
  /** The signed-in email, or "Account" when the session carries none. It
   *  rides the Account row's tooltip: the row says "Account", the page's
   *  name, not the longest string in the rail. */
  accountLabel: string;
  /** Where the wordmark goes: the same landing `/` resolves to. */
  landingHref: string;
  /** Closes the mobile drawer on navigation. Absent on the desktop rail. */
  onNavigate?: () => void;
  /** Icon-only rail. Desktop instance only — the drawer is always full. */
  collapsed?: boolean;
  /** Absent on the drawer instance, which has no collapsed state to toggle. */
  onToggleCollapse?: () => void;
};

// Focus travels through this rail on Tab, so the ring is the brand's, not the
// browser's: a themed ring is the cheapest tell that a surface was designed.
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const ROW_BASE = cn(
  "flex items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition min-h-11 lg:min-h-0 lg:py-2 lg:text-[13px]",
  FOCUS_RING,
);
const ROW_REST =
  "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground";
// The active row is a SOLID pill, not a tint: on the dark rail it is the
// off-white fill with ink text — the brightest thing in the column, which is
// what makes "you are here" survive a glance down it.
const ROW_ACTIVE = "bg-sidebar-foreground text-sidebar font-semibold";
// THE ONE INDENT (MESITA-1841). Written once, used once, and never at w-16:
// the collapsed rail centres its icons, so an inset there would push five of
// nine marks off the column's axis and the group would read as broken rather
// than as nested.
const RAIL_INDENT = "pl-4";
// The full route is prefetched on hover (MESITA-1779): the click then paints
// the body at once instead of the skeleton. The prop works at runtime in
// app/ and is missing from Link's public type, so it is spread in.
const HOVER_PREFETCH = { unstable_dynamicOnHover: true } as object;

const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5";

// THE MARKS NAME THE SUBJECT, NOT THE LABEL (MESITA-1838, extended by
// MESITA-1841 to the three rows that did not exist then):
//
//   Organization  Building2           the company, not the storefront — and
//                                     deliberately unlike Profile's Store, so
//                                     the two subjects never share a glyph
//   Credits       Coins               prepaid money sitting there, against
//                                     Payments' Wallet, which is the account
//                                     it flows through
//   Capabilities  SlidersHorizontal   the same mark the page's own card wears
//                                     (place-manage); a gear would say
//                                     "settings", which is the name this view
//                                     just stopped using
//   Rewards       Gift                what a guest gets back
//
// Profile (Store), Reviews (Star), Payments (Wallet), Activity
// (ChartNoAxesColumn), Account (UserRound) and Admin (Shield) are unchanged —
// each is already the conventional mark for its subject, and swapping a
// correct icon to look busy is churn.

/** The rail's word for a view — the bare word, as in the drawing.
 *  `PLACE_TAB_LABEL` is the same word; this exists so the tests and the rail
 *  share one reader. */
export function placeRowLabel(tab: PlaceTab): string {
  return PLACE_TAB_LABEL[tab];
}

const ORG_ROW: Record<
  OrgRailPage,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  organization: { label: "Organization", Icon: Building2 },
  payments: { label: "Payments", Icon: Wallet },
  credits: { label: "Credits", Icon: Coins },
  activity: { label: "Activity", Icon: ChartNoAxesColumn },
};

const PLACE_ROW_ICON: Record<PlaceTab, React.ComponentType<{ className?: string }>> = {
  profile: Store,
  reviews: Star,
  capabilities: SlidersHorizontal,
  rewards: Gift,
  admin: Shield,
};

function NavRow({
  href,
  label,
  Icon,
  active,
  collapsed,
  indent = false,
  onNavigate,
  onGuardedNavigate,
  title,
}: {
  href: string;
  /** The accessible name: the tooltip at `w-16`, the sr-only text. */
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  /** Inside the Place group. Ignored at `w-16`, which centres every mark. */
  indent?: boolean;
  onNavigate?: () => void;
  onGuardedNavigate?: GuardNav;
  title?: string;
}) {
  return (
    <Link
      href={href}
      {...HOVER_PREFETCH}
      onClick={(e) => {
        // NEVER guard the row you are already on. That click navigates
        // nowhere, so offering "discard your edits and leave" for it is an
        // offer to throw work away for nothing.
        if (!active) onGuardedNavigate?.(href, e);
        // Close the drawer either way: the discard dialog answers on the top
        // layer, and a drawer left open over the new page is the bug.
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      // A given title wins at every width (the Account row's email); else
      // the label is the tooltip only where the label is not on screen.
      title={title ?? (collapsed ? label : undefined)}
      className={cn(
        ROW_BASE,
        active ? ROW_ACTIVE : ROW_REST,
        collapsed ? "justify-center px-0 py-2" : indent && RAIL_INDENT,
      )}
    >
      <Icon className={ICON} />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
  );
}

/** A row that is a fact, not a link: the organizations could not be read. */
function MutedRow({
  label,
  Icon,
  collapsed,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  return (
    <div
      role="status"
      title={collapsed ? label : undefined}
      className={cn(
        ROW_BASE,
        "text-sidebar-muted",
        collapsed && "justify-center px-0 py-2",
      )}
    >
      <Icon className={ICON} />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </div>
  );
}

/** The Place group's header — the selected place's NAME, or the bare word
 *  when there is none yet. Not a link and not a trigger: the switcher lives on
 *  Account (MESITA-1822) and Profile is one row below, so anything clickable
 *  here would be a second door to a page already on screen.
 *
 *  At `w-16` the name cannot fit, so the group is announced by a hairline
 *  instead — the ONE seam in the rail, and the reason the collapsed rail still
 *  reads as two groups rather than nine loose marks. */
function GroupHeader({ name, collapsed }: { name: string; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div role="presentation" className="border-sidebar-border mx-2 my-1.5 border-t" />
    );
  }
  return (
    <div className="mt-3 mb-1 px-2.5">
      <span className={cn(TINY_LABEL_CLASS, "text-sidebar-muted block truncate")}>
        {name}
      </span>
    </div>
  );
}

export function Sidebar({
  scope,
  organizations,
  isSuperAdmin,
  viewerError,
  accountLabel,
  landingHref,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const guardNav = useOpenPlaceGuard();
  const openPlace = useOpenPlace();
  void organizations;

  const org = scope.org;
  const onOrgNew = pathname === SHELL_ROUTES.orgNew;
  // WHICH ORGANIZATION PAGE, by either address: the canonical
  // `/orgs/<id>/<page>` or the flat resolver still in flight. Both light the
  // same row — an operator who typed `/credits` is on Credits.
  const orgPage = orgPageFromPathname(pathname) ?? flatOrgPageFromPathname(pathname);
  // ACCOUNT LIGHTS FOR ACCOUNT, AND NOTHING ELSE. It used to own the
  // organization's ceremonies because that is where they lived; Members,
  // Places and Add place light ORGANIZATION now, whose page is their door, and
  // the create ceremony lights whichever row would take you back — Organization
  // when there is one, the Create row when there is not. A second pill is the
  // failure mode every rail test in this repo counts, and `onOrgNew` appearing
  // in two `active` expressions at once is how it happens.
  const onAccount = pathname === SHELL_ROUTES.account;
  // The view you are on, whichever address you came by: the canonical
  // `/places/<id>/<view>` or the flat resolver still in flight (MESITA-1839).
  const currentView = placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname);

  // Which views the selected place offers this viewer: the ONE matrix
  // (lib/place-tabs), from the published set when the place is on screen,
  // else from the viewer's role in the organization. A pool place: Profile
  // alone. No place: the held set — the pages answer with Add place.
  const foreign = scope.foreignPlaceId !== null;
  const placeTabs: PlaceTab[] = foreign
    ? (openPlace?.id === scope.foreignPlaceId ? openPlace.tabs : (["profile"] as PlaceTab[]))
    : openPlace && scope.placeIsCurrent && openPlace.id === scope.place?.id
      ? openPlace.tabs
      : org
        ? tabsForAccess({ held: true, role: org.myRole, isSuperAdmin })
        : [];
  const noPlace = org !== null && scope.place === null && !foreign;

  // WHERE A ROW POINTS (MESITA-1839). The canonical address names its
  // subject, and the shell has already resolved which subject that is — so the
  // rail links straight there and a click costs ONE hop. The flat address is
  // the fallback for the state where there is nothing to name yet: with no
  // place selected, `/profile` renders the next step (Add place) instead of
  // forwarding nowhere. Either way the row is a live link, never disabled
  // (MESITA-1833).
  const placeId = scope.place?.id ?? scope.foreignPlaceId ?? null;
  const viewRow = (tab: PlaceTab) =>
    placeId ? placeTabHref(placeId, tab) : FLAT_ROUTES[tab];
  const orgRow = (page: OrgRailPage) =>
    org ? orgHref(org.id, page) : FLAT_ROUTES[page];

  // The five place rows, filtered by the matrix. With no place at all the
  // whole held set stays: each page answers with Add place.
  const placeRows = (["profile", "reviews", "capabilities", "rewards", "admin"] as const)
    .filter((tab) => (tab === "admin" ? isSuperAdmin : true))
    .filter((tab) => noPlace || placeTabs.includes(tab));

  // The group's header word: the place's name when there is one — including a
  // pool place, whose name the place layout publishes — else the bare noun.
  const groupName =
    scope.place?.name ??
    (foreign && openPlace?.id === scope.foreignPlaceId ? openPlace.name : null) ??
    "Place";

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      {/* THE TOP LINE: the product. Who you are is the footer. */}
      <div
        className={cn(
          "flex shrink-0 items-center",
          collapsed ? "justify-center" : "px-1.5",
        )}
      >
        <Link
          href={landingHref}
          // Guarded like every other route out of here: the wordmark lands
          // where `/` would, and a place with unsaved edits asks first.
          onClick={(e) => {
            guardNav?.(landingHref, e);
            onNavigate?.();
          }}
          aria-label="Mesita business console"
          title={collapsed ? "Mesita business" : undefined}
          className={cn(
            "inline-flex min-w-0 items-center rounded-md",
            FOCUS_RING,
            collapsed ? "justify-center" : "gap-2",
          )}
        >
          {collapsed ? (
            <MesitaMark className="h-5 w-5" />
          ) : (
            <>
              <MesitaLogo variant="horizontal" className="h-5 w-auto" />
              {/* TINY_LABEL_CLASS, never a heading tag: globals.css puts every
                  bare h1/h2/h3 on the display face, so a 10px eyebrow written as
                  an <h2> would silently become a serif. */}
              <span className={cn(TINY_LABEL_CLASS, "text-sidebar-muted")}>business</span>
            </>
          )}
        </Link>
      </div>

      <nav
        aria-label="Console"
        className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        {viewerError ? (
          <MutedRow
            label="Couldn't load organizations"
            Icon={AlertCircle}
            collapsed={collapsed}
          />
        ) : !org ? (
          <NavRow
            href={SHELL_ROUTES.orgNew}
            label="Create organization"
            Icon={Plus}
            active={onOrgNew}
            collapsed={collapsed}
            onNavigate={onNavigate}
            onGuardedNavigate={guardNav ?? undefined}
          />
        ) : (
          <>
            {ORG_RAIL_PAGES.map((page) => (
              <NavRow
                key={page}
                href={orgRow(page)}
                label={ORG_ROW[page].label}
                Icon={ORG_ROW[page].Icon}
                // Members, Places and Add place are the Organization page's
                // doors, so they light Organization — the row you would go
                // back through.
                active={
                  page === "organization"
                    ? orgPage === "organization" ||
                      orgPage === "members" ||
                      orgPage === "places" ||
                      onOrgNew
                    : orgPage === page
                }
                collapsed={collapsed}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}

            <GroupHeader name={groupName} collapsed={collapsed} />

            {placeRows.map((tab) => (
              <NavRow
                key={tab}
                href={viewRow(tab)}
                label={placeRowLabel(tab)}
                Icon={PLACE_ROW_ICON[tab]}
                active={currentView === tab}
                collapsed={collapsed}
                indent
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}
          </>
        )}
        {/* ACCOUNT IS THE LAST ROW, AND STILL A ROW IN THE NAV. It is not one
            of the two subjects the rail is organized around — it is who is
            looking — so it sits below a seam rather than above the
            Organization rows. It stays INSIDE the landmark because it is
            navigation: a link to a page, parked outside `<nav>` for visual
            reasons, is a link a screen reader's landmark list loses. */}
        <div className="border-sidebar-border mt-2 border-t pt-2">
          <NavRow
            href={SHELL_ROUTES.account}
            label="Account"
            title={accountLabel === "Account" ? "Account" : `Account · ${accountLabel}`}
            Icon={UserRound}
            active={onAccount}
            collapsed={collapsed}
            onNavigate={onNavigate}
            onGuardedNavigate={guardNav ?? undefined}
          />
        </div>
      </nav>

      {/* THE FOOTER IS THE RAIL'S OWN CONTROL, AND ONLY THAT: the one button
          that acts on the rail rather than navigating anywhere. */}
      <div className="mt-2 shrink-0">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            className={cn(
              ROW_BASE,
              ROW_REST,
              "w-full",
              collapsed && "justify-center px-0 py-2",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className={ICON} />
            ) : (
              <PanelLeftClose className={ICON} />
            )}
            <span className={collapsed ? "sr-only" : "truncate"}>Collapse</span>
          </button>
        )}
      </div>
    </aside>
  );
}

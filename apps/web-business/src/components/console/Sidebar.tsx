"use client";

// The whole navigation: one lateral rail, TWO NAMED GROUPS (MESITA-1842).
//
// Pato, 2026-09-14, on a screenshot of the MESITA-1841 rail: "remake that
// fuckin design. no mesita logo, fuck it."
//
//   ─ STRANA GROUP ──────
//   [ ▣ Organization ]  → /orgs/<id>             who is in it, what it holds
//   [ ▤ Payments     ]  → /orgs/<id>/payments    Stripe · Partner
//   [ ◎ Credits      ]  → /orgs/<id>/credits     prepaid, and its liability
//   [ ▥ Activity     ]  → /orgs/<id>/activity    the numbers, by place
//   ─ STRANA DEL VALLE ──
//   [ ⌂ Profile      ]  → /places/<id>/profile
//   [ ★ Reviews      ]  → /places/<id>/reviews
//   [ ⇄ Capabilities ]  → /places/<id>/capabilities   what a guest CAN do
//   [ ⛁ Rewards      ]  → /places/<id>/rewards        what a guest EARNS
//   [ ⛨ Admin        ]  → /places/<id>/admin          super-admin only
//   ═════════════════════
//   ○ Account           the person, and the two switchers
//   ◧ Collapse          the rail's own control
//
// NO WORDMARK. The console runs in a chromeless desktop window whose title bar
// already reads "Mesita Business", so the logo was a second, quieter copy of
// something the OS renders better — paid for with the rail's most valuable row.
// The nav starts at the top.
//
// BOTH GROUPS ARE HEADED, BY THEIR SUBJECT'S NAME. MESITA-1841 headed the
// place group and left the organization's bare, so the rail's one label —
// rendering as the bare word PLACE, because the catalogue is empty — read as an
// orphan rather than as a name. Headed identically, the rail stops being nine
// rows and becomes a sentence: *Strana Group: organization, payments, credits,
// activity. Strana Del Valle: profile, reviews, capabilities, rewards, admin.*
// That is the fact an operator needs before reading any row, and it is the one
// Account otherwise keeps a click away. A subject with no name yet falls back
// to its noun, which is honest rather than orphaned — the group beneath it is
// still live (MESITA-1833).
//
// NOTHING INDENTS. MESITA-1841 inset the place rows; with both groups headed
// that inset said a second time what the header says once, and indenting one
// group and not the other was what made the other look unparented. The
// grouping is carried by the header and the gap. MESITA-1832's flat law is
// therefore back in force as written, and `shell-chrome.test.ts` refuses every
// inset, tree line, bullet, box, well and `role="group"` again.
//
// ONE FOOTER, PINNED. Account sat directly under the place rows while Collapse
// was pinned to the bottom, so the rail's empty space fell BETWEEN two footer
// items — and empty space above a footer reads as a layout that failed, where
// empty space below one reads as intentional. They are one block now.
//
// ACCOUNT IS THE LAST ROW, not row one. It is not one of the two subjects — it
// is the person — and Pato's drawing leaves it off the numbered list entirely.
// It keeps a row because nothing else reaches you, sign-out, or the two
// switchers, and it stays INSIDE the nav landmark: a link parked outside
// `<nav>` for visual reasons is a link a screen reader's landmark list loses.
// It lights for `/account` alone. Members and Places have addresses and no row
// of their own — the Organization page is their door, and they light ITS row.
//
// NO ID IN ANYTHING THE OPERATOR READS. Every href carries one; none is shown.
// A one-place owner meets no id, no switcher, and no chevron. Exactly ONE
// filled pill, always.
//
// NO PLACE YET: the five place rows stay, AT FULL STRENGTH (MESITA-1833); each
// opens the page, which answers with the one next step. The rail never
// shrinks. Zero organizations: Create organization and Account. A failed
// organizations read: a muted line and Account, never the create row
// (MESITA-1793's law).
//
// THEY USED TO BE DIMMED, and the dimming was a lie. `opacity-60` plus a
// "Profile · add a place first" tooltip painted five of seven rows as
// disabled — while every one of them was a live link landing on NoPlaceYet,
// which is a real next step, not a dead end. With zero places in the
// catalogue that is the state EVERY account is in, so the first thing a new
// operator met was a console that looked broken. Pato, 2026-09-14: "make all
// this functional. not hidden shit."
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
import { useOpenPlace, useOpenPlaceGuard, type GuardNav } from "@/components/console/OpenPlace";
import {
  FLAT_ROUTES,
  ORG_RAIL_TARGETS,
  SHELL_ROUTES,
  flatOrgTargetFromPathname,
  flatViewFromPathname,
  orgHref,
  orgTargetFromPathname,
  type OrgRailTarget,
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
// The full route is prefetched on hover (MESITA-1779): the click then paints
// the body at once instead of the skeleton. The prop works at runtime in
// app/ and is missing from Link's public type, so it is spread in.
const HOVER_PREFETCH = { unstable_dynamicOnHover: true } as object;

const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5";

// THE MARKS NAME THE SUBJECT, NOT THE LABEL (MESITA-1838, extended by
// MESITA-1841 to the rows that did not exist then):
//
//   Organization  Building2           the company, not the storefront — and
//                                     deliberately unlike Profile's Store, so
//                                     the two subjects never share a glyph
//   Payments      Wallet              the page is the purse, not one card
//   Credits       Coins               money sitting there, against Payments'
//                                     wallet, which is what it flows through
//   Activity      ChartNoAxesColumn   counts over time; a heart-rate squiggle
//                                     reads medical
//   Profile       Store               the PLACE's public page, not a document
//   Capabilities  SlidersHorizontal   the mark the page's own card wears; a
//                                     gear would say "settings", the name this
//                                     view stopped using
//   Rewards       Gift                what a guest gets back
//
// Reviews (Star), Admin (Shield) and Account (UserRound) are each already the
// conventional mark for their subject; swapping a correct icon to look busy is
// churn.

/** The rail's word for a view — the bare word, as in the drawing.
 *  `PLACE_TAB_LABEL` is the same word; this exists so the tests and the rail
 *  share one reader. */
export function placeRowLabel(tab: PlaceTab): string {
  return PLACE_TAB_LABEL[tab];
}

const ORG_ROW: Record<
  OrgRailTarget,
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

/** The place's five, in the drawing's order. Admin is super-admin only. */
const PLACE_ROWS = ["profile", "reviews", "capabilities", "rewards", "admin"] as const;

function NavRow({
  href,
  label,
  Icon,
  active,
  collapsed,
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
        collapsed && "justify-center px-0 py-2",
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

/** A group's header: its subject's NAME. Not a link and not a trigger — the
 *  switchers are Account's (MESITA-1822), and the group's own first row is
 *  already the page about that subject, so anything clickable here would be a
 *  second door to something one row below.
 *
 *  At `w-16` a name cannot fit, so the group is announced by a hairline
 *  instead — which is what keeps the collapsed rail reading as two groups
 *  rather than nine loose marks. */
function GroupHeader({
  name,
  collapsed,
  first,
}: {
  name: string;
  collapsed: boolean;
  /** The first group needs no space above it, and no seam at `w-16`. */
  first?: boolean;
}) {
  if (collapsed) {
    return first ? null : (
      <div role="presentation" className="border-sidebar-border mx-2 my-1.5 border-t" />
    );
  }
  return (
    <div className={cn("mb-1 px-2.5", first ? "mt-0" : "mt-4")}>
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
  // WHICH ORGANIZATION ADDRESS, by either spelling: the canonical
  // `/orgs/<id>[/<page>]` or the flat resolver still in flight. Both light the
  // same row — an operator who typed `/credits` is on Credits.
  const orgTarget =
    orgTargetFromPathname(pathname) ?? flatOrgTargetFromPathname(pathname);
  // ACCOUNT LIGHTS FOR ACCOUNT, AND NOTHING ELSE. It used to own the
  // organization's ceremonies because that is where they lived; Members,
  // Places and Add place light ORGANIZATION now, whose page is their door, and
  // the create ceremony lights whichever row would take you back —
  // Organization when there is one, the Create row when there is not. A second
  // pill is the failure mode every rail test in this repo counts, and
  // `onOrgNew` appearing in two `active` expressions at once is how it
  // happens.
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
  const orgRow = (target: OrgRailTarget) =>
    org ? orgHref(org.id, target) : FLAT_ROUTES[target];

  const placeRows = PLACE_ROWS.filter((tab) =>
    tab === "admin" ? isSuperAdmin : true,
  ).filter((tab) => noPlace || placeTabs.includes(tab));

  // EACH GROUP'S HEADER IS ITS SUBJECT'S NAME, falling back to the noun. The
  // place's name can arrive from the rail scope (a place an organization of
  // mine holds) or from the layout's publish (a pool place opened from the
  // list, which no organization of mine holds and whose name the rail
  // therefore cannot know on its own).
  const orgName = org?.name ?? "Organization";
  const placeName =
    scope.place?.name ??
    (foreign && openPlace?.id === scope.foreignPlaceId ? openPlace.name : null) ??
    "Place";

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-3 pb-3">
      <nav
        aria-label="Console"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
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
            <GroupHeader name={orgName} collapsed={collapsed} first />
            {ORG_RAIL_TARGETS.map((target) => (
              <NavRow
                key={target}
                href={orgRow(target)}
                label={ORG_ROW[target].label}
                Icon={ORG_ROW[target].Icon}
                // Members, Places and Add place are the Organization page's
                // doors, so they light Organization — the row you would go
                // back through.
                active={
                  target === "organization"
                    ? orgTarget === "organization" ||
                      orgTarget === "members" ||
                      orgTarget === "places" ||
                      onOrgNew
                    : orgTarget === target
                }
                collapsed={collapsed}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}

            <GroupHeader name={placeName} collapsed={collapsed} />
            {placeRows.map((tab) => (
              <NavRow
                key={tab}
                href={viewRow(tab)}
                label={placeRowLabel(tab)}
                Icon={PLACE_ROW_ICON[tab]}
                active={currentView === tab}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}
          </>
        )}
      </nav>

      {/* ONE FOOTER, PINNED TO THE BOTTOM: the person, then the rail's own
          control. Keeping Account up with the nav and Collapse down here put
          the rail's empty space BETWEEN them, which reads as a layout that
          failed rather than as room to spare. */}
      <div className="border-sidebar-border mt-2 flex shrink-0 flex-col gap-0.5 border-t pt-2">
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

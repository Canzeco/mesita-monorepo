"use client";

// The whole navigation: ONE FLAT COLUMN OF SIX NOUNS, and one indent
// (MESITA-1844, extended by MESITA-1845).
//
// Pato, 2026-09-14, after eight passes over this rail in one afternoon, drew
// it — then added a row and moved one back:
//
//   [ ○ Account      ]  → /account                  the person
//   [ ▣ Organization ]  → /orgs/<id>                what it is, who is in it
//   [ ⚇ Customers    ]  → /orgs/<id>/customers      who keeps coming back
//   [ ▤ Payments     ]  → /orgs/<id>/payments       Stripe · Partner · Credits
//   [ ▥ Activity     ]  → /orgs/<id>/activity       the numbers, by place
//   [ ⛁ Places       ]  → /orgs/<id>/places         what it holds
//       Profile         → /places/<id>/profile
//       Reviews         → /places/<id>/reviews
//       Capabilities    → /places/<id>/capabilities   what a guest CAN do
//       Rewards         → /places/<id>/rewards        what a guest EARNS
//       Admin           → /places/<id>/admin          super-admin only
//   ═════════════════════
//   ◧ Collapse          the rail's own control
//
// "KEEP IT STANDARD AND BORING." Pato, on the pass before this one: *"just
// standard spacing and design, don't use lots of fucking different styles in
// the same menu."* So there is ONE row shape and every row wears it — same
// height, same padding, same icon size, same type size, same radius — and the
// only visual difference left in the column is which row is LIT. Every
// ornament the rail accumulated is gone with it: the wordmark (MESITA-1842),
// the two group headers, the footer's second seam, the avatar, the chevrons.
//
// ACCOUNT IS ROW ONE. MESITA-1842 put it in the footer on the reasoning that
// it "is not one of the two subjects" — and there are no two subjects now.
// The column reads top to bottom as *who you are, what you run, how it is
// doing, where it happens*, which is the order a person actually asks those
// questions in. It lights for `/account` alone.
//
// PAYMENTS IS BACK, one issue after MESITA-1844 took it out on *"payments
// inside org."* Pato's next list puts it in the column again, so it is in the
// column again. CREDITS did not come with it: asked where Credits goes, he
// said *"merge"*, and it is the `SoonStrip` at the foot of Payments — the page
// it was split out of in MESITA-1841. MEMBERS went the other way in
// MESITA-1847: not a page behind a row but CONTENT on the Organization page,
// so every organization address is a rail row again and no screen renders
// with zero pills, which reads exactly like a broken console.
//
// CUSTOMERS IS A LIVE ROW. Pato wrote it "(Soon)", and a Soon badge in a rail
// is a dimmed row — the exact thing MESITA-1833 forbids, in his own words:
// "make all this functional. not hidden shit." So the row renders at full
// strength and its page carries the badge.
//
// ONE INDENT, ONE DEPTH. The place's five sit under Places because they are
// about a place and Places is the row they belong to; the drawing's own
// asterisks say so. This overturns MESITA-1842's flat law one issue after it
// was restored — what the law still forbids is everything that was only ever
// decoration (a tree line, a bullet, a box, a well, a second eyebrow, a
// `role="group"`) and a SECOND depth, which is the point a rail becomes a file
// tree. At `w-16` nothing indents: there is no label to align to, and the
// icons carry the whole column.
//
// NO ID IN ANYTHING THE OPERATOR READS. Every href carries one; none is shown.
// A one-place owner meets no id, no switcher and no chevron. Exactly ONE
// filled pill, always.
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
  Gift,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Shield,
  SlidersHorizontal,
  Star,
  Store,
  UserRound,
  Users,
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
// THE ONE ROW SHAPE. Every row in the column is this and nothing else — the
// four nouns, the five views beneath Places, and Collapse. A second shape is
// the thing Pato threw out.
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
// THE ONE INDENT: the place's five, under the row they belong to. It is a
// left pad on the same row shape — not a wrapper, not a rule, not a bullet —
// so the five are still the same rows, moved. `twMerge` drops `px-2.5`'s left
// half in favour of this.
const ROW_INDENT = "pl-7 lg:pl-6";
// The full route is prefetched on hover (MESITA-1779): the click then paints
// the body at once instead of the skeleton. The prop works at runtime in
// app/ and is missing from Link's public type, so it is spread in.
const HOVER_PREFETCH = { unstable_dynamicOnHover: true } as object;

const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5";

// THE MARKS NAME THE SUBJECT, NOT THE LABEL (MESITA-1838, MESITA-1841, and
// MESITA-1844 for the row that arrived):
//
//   Account       UserRound           the PERSON, one of them
//   Organization  Building2           the company, not the storefront — and
//                                     deliberately unlike Profile's Store, so
//                                     the two subjects never share a glyph
//   Customers     Users               PEOPLE, plural, against Account's one —
//                                     the pairing IS the meaning: you, and
//                                     everyone who comes to you
//   Payments      Wallet              the page is the purse, not one card
//   Activity      ChartNoAxesColumn   counts over time; a heart-rate squiggle
//                                     reads medical
//   Places        Layers              a stack of them, and the SAME mark the
//                                     Organization page's own Places door
//                                     wears — one subject, one glyph, on both
//                                     screens that offer it
//   Profile       Store               the PLACE's public page, not a document
//   Capabilities  SlidersHorizontal   the mark the page's own card wears; a
//                                     gear would say "settings", the name this
//                                     view stopped using
//   Rewards       Gift                what a guest gets back
//
// Reviews (Star) and Admin (Shield) are each already the conventional mark for
// their subject; swapping a correct icon to look busy is churn. Coins is gone
// from this app entirely: Credits has no row and no page of its own any more
// (MESITA-1845), only a dashed strip that carries no mark.

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
  customers: { label: "Customers", Icon: Users },
  payments: { label: "Payments", Icon: Wallet },
  activity: { label: "Activity", Icon: ChartNoAxesColumn },
  places: { label: "Places", Icon: Layers },
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
  indent,
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
  /** One of the place's five, under Places. Never a second depth, and never
   *  at `w-16`, where there is no label to align to. */
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
        indent && !collapsed && ROW_INDENT,
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
  // same row — an operator who typed `/members` is on the Organization row,
  // because the Organization page is Members' door.
  const orgTarget =
    orgTargetFromPathname(pathname) ?? flatOrgTargetFromPathname(pathname);
  // ACCOUNT LIGHTS FOR ACCOUNT, AND NOTHING ELSE. Every organization ceremony
  // and every door-only page lights ORGANIZATION. A second pill is the failure
  // mode every rail test in this repo counts, and it arrives exactly this way:
  // one row keeping a clause after another row took the subject.
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

  const placeRows = PLACE_ROWS.filter((tab) =>
    tab === "admin" ? isSuperAdmin : true,
  ).filter((tab) => noPlace || placeTabs.includes(tab));

  // WHICH ROW A ROW LIGHTS FOR. Every organization address is a rail row
  // now (MESITA-1847: Members became content ON the Organization page rather
  // than an address behind it), so each row takes its own — except the create
  // ceremony, which has no organization to name yet and would otherwise light
  // nothing. Places also takes the Add place ceremony beneath its list.
  const orgRowActive = (target: OrgRailTarget) =>
    target === "organization"
      ? orgTarget === "organization" || onOrgNew
      : orgTarget === target;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-3 pb-3">
      <nav
        aria-label="Console"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        {/* THE PERSON, FIRST (MESITA-1844). Before the navigation, not under
            it: the column reads who you are, what you run, how it is doing,
            where it happens. It is the one row every state renders. */}
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
            {ORG_RAIL_TARGETS.map((target) => (
              <NavRow
                key={target}
                href={orgHref(org.id, target)}
                label={ORG_ROW[target].label}
                Icon={ORG_ROW[target].Icon}
                active={orgRowActive(target)}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}
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
      </nav>

      {/* THE RAIL'S OWN CONTROL, pinned to the bottom and alone there. Account
          moved to row one (MESITA-1844), so the footer is one button under one
          seam, and the rail's empty space falls above it — which reads as room
          to spare rather than as a layout that failed. */}
      {onToggleCollapse && (
        <div className="border-sidebar-border mt-2 flex shrink-0 flex-col gap-0.5 border-t pt-2">
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
        </div>
      )}
    </aside>
  );
}

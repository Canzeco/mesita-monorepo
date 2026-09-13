"use client";

// The whole navigation: one lateral rail, SEVEN ROWS, nothing else
// (MESITA-1822).
//
// Pato, 2026-09-13: "Sidebar menu: Account. Organization. (change
// organization, change place) Place Profile. Place Reviews. Place Activity.
// Place Settings. Place Admin." Two passes (1815, 1818) read the parenthesis
// as rows under Organization and put the two switchers in the rail; on the
// result: "still looks like fucking shit. wtf? i told you". The parenthesis
// names what the Organization PAGE does. The switchers live there
// (ScopeSwitchers.tsx); the rail is the seven pages, at every width, in
// every state.
//
//   [ ○ Account                  ]  → /account (the email in the tooltip)
//   [ ▤ Organization             ]  → /orgs/<id>; its list and Add place light it
//   [ ▢ Place Profile            ]  → /places/<id>/profile
//   [ ★ Place Reviews            ]     "Place " quieted by WEIGHT, never alpha
//   [ ~ Place Activity    ▮pill  ]  exactly ONE filled pill, always
//   [ ⚙ Place Settings           ]
//   [ ⛨ Place Admin              ]  super-admin only
//   ─────
//   ◧ Collapse                      the footer: the rail's own control
//
// THE PLACE ROWS ARE ALWAYS THERE. An organization holding no place gets the
// same five rows, muted, each a door to Add place (owner) or to the
// organization's list (everyone else) — never an "Add place" row in their
// slot, never a rail that shrinks to two lines. Zero organizations: Account
// and Create organization. A failed organizations read: Account and a muted
// line, never the create row (MESITA-1793's law).
//
// THE SCOPE IS READ OFF THE PATHNAME (lib/rail-scope.ts): `/orgs/<id>/…`
// names the organization; `/places/<id>/…` names the place and its holder;
// everything else falls back to the organization and place remembered from
// the last visit. The rail lists no portfolio and holds no switcher.
//
// FLAT. Nothing in this file indents — no inset, no tree line, no bullet, no
// `pl-8`, no box, no eyebrow, no seam — and `shell-chrome.test.ts` forbids
// all of them. Seven rows in one column.
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
  Activity,
  AlertCircle,
  Building2,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Shield,
  Star,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { useOpenPlace, useOpenPlaceGuard, type GuardNav } from "@/components/console/OpenPlace";
import { canAddPlace } from "@/lib/active-organization";
import {
  ORG_PAGE_LABEL,
  SHELL_ROUTES,
  orgHref,
  orgPageFromPathname,
  orgPlacesHref,
  orgPlacesNewHref,
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
// The full route is prefetched on hover (MESITA-1779): the click then paints
// the body at once instead of the skeleton. The prop works at runtime in
// app/ and is missing from Link's public type, so it is spread in.
const HOVER_PREFETCH = { unstable_dynamicOnHover: true } as object;

const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5";

const VIEW_ICON: Record<PlaceTab, React.ComponentType<{ className?: string }>> = {
  profile: FileText,
  reviews: Star,
  activity: Activity,
  settings: Settings2,
  admin: Shield,
};

/** The rail's word for a view: the scope word is IN the label now that no
 *  eyebrow carries it (Pato: "I don't care word place is redundant"). The
 *  crumb and the heading keep the bare word — `PLACE_TAB_LABEL` is theirs.
 *  This string is the accessible name (title, tests); `PlaceRowLabel` is how
 *  it is painted. */
export function placeRowLabel(tab: PlaceTab): string {
  return `Place ${PLACE_TAB_LABEL[tab]}`;
}

/** Five rows begin with the same word, and people scan first words. The
 *  prefix is quieted by WEIGHT (400 against the row's own 500, or 600 on the
 *  pill) at the row's own ink — never by alpha: 55% of muted ink over the
 *  sidebar ground is ~2.5:1, and 13px text needs 4.5:1 (MESITA-1818, 8A).
 *  The noun carries no class of its own: it inherits the row's weight and
 *  color, so it is 600 inside the pill like every other pill. */
function PlaceRowLabel({ tab }: { tab: PlaceTab }) {
  return (
    <>
      <span className="font-normal">Place </span>
      {PLACE_TAB_LABEL[tab]}
    </>
  );
}

function NavRow({
  href,
  label,
  labelNode,
  Icon,
  active,
  muted = false,
  collapsed,
  onNavigate,
  onGuardedNavigate,
  title,
}: {
  href: string;
  /** The accessible name: the tooltip at `w-16`, the sr-only text. */
  label: string;
  /** How the label is painted when it is not just `label` (the quieted
   *  "Place " prefix). Never changes the accessible name. */
  labelNode?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  /** A row whose page does not exist yet (a place view with no place): the
   *  disabled look, but still a door — to the step that makes it exist. */
  muted?: boolean;
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
        muted && "opacity-60",
        collapsed && "justify-center px-0 py-2",
      )}
    >
      <Icon className={ICON} />
      <span className={collapsed ? "sr-only" : "truncate"}>
        {collapsed ? label : (labelNode ?? label)}
      </span>
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
  const orgPage = orgPageFromPathname(pathname);
  const onOrgNew = pathname === SHELL_ROUTES.orgNew;
  const onAccount = pathname === SHELL_ROUTES.account;
  const currentView = placeTabFromPathname(pathname);

  // The place the five rows are about: the pathname's place when it is held,
  // the pool place it names otherwise (name and views arrive by publish),
  // else the place remembered for this organization — else none, and the
  // rows are doors to making one.
  const foreign =
    scope.foreignPlaceId !== null
      ? openPlace?.id === scope.foreignPlaceId
        ? openPlace
        : { id: scope.foreignPlaceId, name: "Place", tabs: ["profile"] as PlaceTab[] }
      : null;
  const placeTabs: PlaceTab[] = foreign
    ? foreign.tabs
    : openPlace && scope.placeIsCurrent && openPlace.id === scope.place?.id
      ? openPlace.tabs
      : org
        ? tabsForAccess({ held: true, role: org.myRole, isSuperAdmin })
        : [];
  const placeSubjectId = foreign?.id ?? scope.place?.id ?? null;
  const viewIsHere = foreign !== null || scope.placeIsCurrent;
  // No place yet: every place row is a door to the step that makes one —
  // Add place for the owner, the organization's list for everyone else.
  const noPlaceHref = org && canAddPlace(org.myRole)
    ? orgPlacesNewHref(org.id)
    : org
      ? orgPlacesHref(org.id)
      : SHELL_ROUTES.orgNew;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      {/* THE TOP LINE: the product. Who you are is the first box below. */}
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
            {/* ONE organization page (MESITA-1810); its list, the Add place
                step and the create ceremony beneath it light this same row —
                they are the organization's own steps, not pages of their own.
                The switchers live on the page (ScopeSwitchers). */}
            <NavRow
              href={orgHref(org.id)}
              label={ORG_PAGE_LABEL.overview}
              Icon={Building2}
              active={orgPage !== null || onOrgNew}
              collapsed={collapsed}
              onNavigate={onNavigate}
              onGuardedNavigate={guardNav ?? undefined}
            />
            {placeTabs.map((tab) => (
              <NavRow
                key={tab}
                href={placeSubjectId ? placeTabHref(placeSubjectId, tab) : noPlaceHref}
                label={placeRowLabel(tab)}
                labelNode={<PlaceRowLabel tab={tab} />}
                Icon={VIEW_ICON[tab]}
                active={placeSubjectId !== null && viewIsHere && currentView === tab}
                muted={placeSubjectId === null}
                title={placeSubjectId === null ? `${placeRowLabel(tab)} · add a place first` : undefined}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}
          </>
        )}
      </nav>

      {/* THE FOOTER IS THE RAIL'S OWN CONTROL, AND ONLY THAT: the one button
          that acts on the rail rather than navigating anywhere. */}
      {onToggleCollapse && (
        <div className="border-sidebar-border mt-2 shrink-0 border-t pt-2">
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

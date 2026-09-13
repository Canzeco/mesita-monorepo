"use client";

// The whole navigation: one lateral rail, SIX PAGES (MESITA-1832) — seven
// for a super-admin.
//
// Pato, 2026-09-13, with a drawing of six rows: "optimize the ui as if it
// was just for orgs that only have one place. Account must contain select
// account, organization selector, and place selector. Place profile. Place
// reviews. Org & place payments. Place activity. Org & place settings. Make
// the frontend web routes /account /profile /reviews /payments /activity
// /settings."
//
//   [ ○ Account     ]  → /account   who you are · switch organization · switch place
//   [ ▢ Profile     ]  → /profile   THE SELECTED PLACE's profile
//   [ ★ Reviews     ]  → /reviews
//   [ ▭ Payments    ]  → /payments  the organization's money (Stripe · Partner · Credits)
//   [ ~ Activity    ]  → /activity
//   [ ⚙ Settings    ]  → /settings  the place's switches · the organization's members
//   [ ⛨ Admin       ]  → /admin     super-admin only
//   ─────
//   ◧ Collapse         the footer: the rail's own control
//
// NO ID IN ANY ADDRESS. Every page is about the selected place and its
// organization — the console's memory (lib/selected-place.ts server-side,
// lib/rail-scope.ts here). A one-place owner never meets an id, a switcher
// in the rail, or the word "organization" in a row. Exactly ONE filled
// pill, always: the ceremonies (/orgs/new, the list, Add place) light the
// row they belong to (Account).
//
// NO PLACE YET: Profile · Reviews · Activity · Settings (· Admin) stay,
// muted; each opens the page, which answers with the one next step. The
// rail never shrinks. Zero organizations: Account and Create organization.
// A failed organizations read: Account and a muted line, never the create
// row (MESITA-1793's law).
//
// FLAT. Nothing in this file indents — no inset, no tree line, no bullet, no
// `pl-8`, no box, no eyebrow, no seam — and `shell-chrome.test.ts` forbids
// all of them.
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
  CreditCard,
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
import {
  SHELL_ROUTES,
  flatViewFromPathname,
  orgPageFromPathname,
  viewHref,
} from "@/lib/console-routes";
import { PLACE_TAB_LABEL, tabsForAccess, type PlaceTab } from "@/lib/place-tabs";
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


/** The rail's word for a view — the bare word, as in the drawing (Account ·
 *  Profile · Reviews · Payments · Activity · Settings). `PLACE_TAB_LABEL` is
 *  the same word; this exists so the tests and the rail share one reader. */
export function placeRowLabel(tab: PlaceTab): string {
  return PLACE_TAB_LABEL[tab];
}

function NavRow({
  href,
  label,
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
  // Account owns its ceremonies: the create step, the organization's list
  // and the Add place step all light Account — while there IS an Account
  // scope to own them. With no organization the create step is its own row.
  const onAccount =
    pathname === SHELL_ROUTES.account ||
    (org !== null && (onOrgNew || orgPageFromPathname(pathname) !== null));
  const currentView = flatViewFromPathname(pathname);

  // Which views the selected place offers this viewer: the ONE matrix
  // (lib/place-tabs), from the published set when the place is on screen,
  // else from the viewer's role in the organization. A pool place: Profile
  // alone. No place: the held set, muted — the pages answer with Add place.
  const foreign = scope.foreignPlaceId !== null;
  const placeTabs: PlaceTab[] = foreign
    ? (openPlace?.id === scope.foreignPlaceId ? openPlace.tabs : (["profile"] as PlaceTab[]))
    : openPlace && scope.placeIsCurrent && openPlace.id === scope.place?.id
      ? openPlace.tabs
      : org
        ? tabsForAccess({ held: true, role: org.myRole, isSuperAdmin })
        : [];
  const noPlace = org !== null && scope.place === null && !foreign;

  // The six rows, in the drawing's order; Payments is the organization's,
  // the rest are the place's.
  type Row = { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; place?: PlaceTab };
  const all: Row[] = [
    { href: viewHref("profile"), label: placeRowLabel("profile"), Icon: FileText, place: "profile" },
    { href: viewHref("reviews"), label: placeRowLabel("reviews"), Icon: Star, place: "reviews" },
    { href: SHELL_ROUTES.payments, label: "Payments", Icon: CreditCard },
    { href: viewHref("activity"), label: placeRowLabel("activity"), Icon: Activity, place: "activity" },
    { href: viewHref("settings"), label: placeRowLabel("settings"), Icon: Settings2, place: "settings" },
  ];
  if (isSuperAdmin) {
    all.push({ href: viewHref("admin"), label: placeRowLabel("admin"), Icon: Shield, place: "admin" });
  }
  const rows = all.filter((r) => !r.place || noPlace || placeTabs.includes(r.place));

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
          rows.map((row) => (
            <NavRow
              key={row.href}
              href={row.href}
              label={row.label}
              Icon={row.Icon}
              active={row.place ? currentView === row.place : pathname === row.href}
              muted={row.place !== undefined && noPlace}
              title={row.place && noPlace ? `${row.label} · add a place first` : undefined}
              collapsed={collapsed}
              onNavigate={onNavigate}
              onGuardedNavigate={guardNav ?? undefined}
            />
          ))
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

"use client";

// The whole navigation: one lateral rail. Client because active state needs
// usePathname and every href carries the active organization.
//
// THE RAIL LISTS THE PLACES THEMSELVES (MESITA-1715). It used to hold a link
// called Org Places pointing at a filtered list. Pato: "list of org places
// here." A menu whose rows are the actual things beats a menu whose rows are
// links to lists of them — one click instead of two, and the portfolio is
// visible without navigating to see it.
//
// ORDER, top to bottom: Account, Organization, then the org's places, then
// All Places at the floor. Account leads because it is the door to every
// organization you belong to, so it sits above the one you are looking at.
// All Places sinks to the bottom because it is the superset you drop into
// occasionally to claim something, not a place you work.
//
// THERE IS NO PUBLIC PLACES ROW. Org places are a SUBSET of All Places, and a
// subset earns a row. Public is the COMPLEMENT — All minus Org — which is
// exactly the fact the Owned column already carries on every row of the list.
// Giving a complement a row makes a filter look like a place, which is the
// mistake MESITA-1614 unwound. `?owned=public` still resolves, so a bookmark
// keeps working; it stopped being a destination, not a capability.
//
// FLAT, WITH ONE EXCEPTION. No tree lines, no bullet dots. The only thing
// that ever indents is the OPEN place's views, dropped in under its own row
// and gone the moment you leave it. Grouping by indent puts the active row at
// the deepest inset and inverts hierarchy; an expanded row is not a tree.
//
// LIGHT, not admin's dark slab. Every text token is a semantic pair with a
// measured ratio (`muted-foreground` on `sidebar` is 6.31:1), never an
// opacity fraction — admin's rail ships three AA failures that way.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  FileText,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  SlidersHorizontal,
  Store,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import {
  useOpenPlace,
  useOpenPlaceGuard,
  usePortfolioVersion,
} from "@/components/console/OpenPlace";
import { listRailPlacesAction } from "@/app/(shell)/actions/places";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeIdFromPathname,
  placesHref,
  withOrg,
} from "@/lib/console-routes";
import { PLACE_TAB_LABEL, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { useActiveOrg, type ChromeOrg } from "@/lib/use-active-org";

type SidebarProps = {
  organizations: ChromeOrg[];
  /** Closes the mobile drawer on navigation. Absent on the desktop rail. */
  onNavigate?: () => void;
  /** Icon-only rail. Desktop instance only — the drawer is always full. */
  collapsed?: boolean;
  /** Absent on the drawer instance, which has no collapsed state to toggle. */
  onToggleCollapse?: () => void;
};

const ROW_BASE =
  "flex items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition min-h-11 lg:min-h-0 lg:py-2 lg:text-[13px]";
const ROW_REST =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";
// The active row is a SOLID ink pill, not a tint. It is the one place in the
// rail where the console's foreground appears as a fill, which is what makes
// "you are here" survive a glance down a light column.
const ROW_ACTIVE = "bg-foreground text-background font-semibold";
// The open place's own row: it heads the views below it, so it goes bold
// without a fill. Exactly one filled pill on screen at a time.
const ROW_HEADING =
  "text-foreground font-semibold hover:bg-sidebar-accent";

// Profile is FileText, not a person: Account is the person in this rail, and
// two identical glyphs a few rows apart is how a menu starts reading as mush.
const TAB_ICON: Record<PlaceTab, React.ComponentType<{ className?: string }>> = {
  profile: FileText,
  capabilities: SlidersHorizontal,
  activity: Activity,
  admin: Shield,
};

function NavRow({
  href,
  label,
  Icon,
  active,
  collapsed,
  /** The open place's views, and ONLY those. Nothing else in the rail indents. */
  inset = false,
  /** This row owns the group below it. Reads as a heading, not a destination
   *  you are currently at — the pill belongs to one of its views. */
  heading = false,
  onNavigate,
  onGuardedNavigate,
  title,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  inset?: boolean;
  heading?: boolean;
  onNavigate?: () => void;
  onGuardedNavigate?: (href: string, e: { preventDefault: () => void }) => boolean;
  title?: string;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        // NEVER guard the row you are already on. That click navigates
        // nowhere, so offering "discard your edits and leave" for it is an
        // offer to throw work away for nothing.
        if (!active) onGuardedNavigate?.(href, e);
        // Close the drawer either way. The discard dialog renders inside
        // `main`, behind the drawer's scrim, so leaving the rail up buries the
        // question the person now has to answer.
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : title}
      className={cn(
        ROW_BASE,
        active ? ROW_ACTIVE : heading ? ROW_HEADING : ROW_REST,
        collapsed ? "justify-center px-0 py-2" : inset && "pl-8",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
  );
}

/** Groups without indenting. Collapsed there is no room for words, so the
 *  grouping survives as a rule — the same trade web-admin's rail makes. */
function SectionBreak({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="border-sidebar-border mx-2 my-2 border-t" />;
  }
  return (
    <div className="mt-3 mb-1 px-2.5">
      <span className={cn(TINY_LABEL_CLASS, "block truncate")} title={label}>
        {label}
      </span>
    </div>
  );
}

export function Sidebar({
  organizations,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ONE resolver for every piece of chrome — see lib/use-active-org.ts.
  const { activeOrg, activeOrgId } = useActiveOrg(organizations);

  const owned = ownedFromParam(searchParams.get("owned"));
  const openPlace = useOpenPlace();
  const guardNav = useOpenPlaceGuard();
  const openPlaceId = placeIdFromPathname(pathname);
  const onPlacesList = pathname === SHELL_ROUTES.places;
  const portfolioVersion = usePortfolioVersion();

  // The org's places, fetched through a server action rather than by the shell
  // layout — a layout cannot read searchParams, so it could only ever have
  // guessed `organizations[0]`, which is the bug that made the breadcrumb lie.
  //
  // The answer is stored WITH the organization it answered for, and read back
  // only when those still match. That makes the org switcher safe by
  // construction rather than by a cleanup flag: a slow reply for the previous
  // organization cannot paint over the current one, and there is no state to
  // clear when the active org goes away.
  const [fetched, setFetched] = useState<{
    orgId: string;
    rows: { id: string; name: string }[];
  } | null>(null);
  useEffect(() => {
    if (!activeOrgId) return;
    let live = true;
    listRailPlacesAction(activeOrgId).then((rows) => {
      if (live) setFetched({ orgId: activeOrgId, rows });
    });
    return () => {
      live = false;
    };
    // portfolioVersion is the claim/release signal — see PlaceHoldButton.
  }, [activeOrgId, portfolioVersion]);
  const loaded = fetched?.orgId === activeOrgId;
  const places = loaded ? fetched.rows : [];

  const href = (to: string) => withOrg(to, activeOrgId);

  // Which of the place's views is open. Profile has no segment of its own —
  // it IS /places/<id> — so a bare place pathname means Profile.
  const activeTab: PlaceTab | null = openPlaceId
    ? ((pathname.split("/")[3] as PlaceTab | undefined) ?? "profile")
    : null;

  // A place you have open that this org does not hold — you reached it from
  // All Places. It is not in the list, so it gets its own break rather than
  // being silently missing from a rail that is showing you its views.
  //
  // GATED ON `loaded`. While the list is in flight `places` is empty, so an
  // owned place would read as foreign, render its own standalone section, and
  // then jump into the portfolio the moment the fetch lands — a visible
  // shuffle on every place-page load. Unknown is not the same as foreign.
  const openIsForeign =
    loaded &&
    openPlace != null &&
    openPlace.id === openPlaceId &&
    !places.some((p) => p.id === openPlace.id);

  const viewRows = (place: { id: string; name: string }) =>
    openPlace?.id === place.id
      ? openPlace.tabs.map((tab) => (
          <NavRow
            key={tab}
            href={placeTabHref(place.id, tab, activeOrgId)}
            label={PLACE_TAB_LABEL[tab]}
            Icon={TAB_ICON[tab]}
            active={activeTab === tab}
            collapsed={collapsed}
            inset
            title={place.name}
            onNavigate={onNavigate}
            onGuardedNavigate={guardNav ?? undefined}
          />
        ))
      : null;

  const switchHref = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("org", id);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      <Link
        href={href(SHELL_ROUTES.organization)}
        // Guarded like every other route out of here. The Organization ROW is
        // a few lines down and goes to the same place; one of them silently
        // discarding unsaved edits while the other asks is worse than either
        // rule applied consistently.
        onClick={(e) => {
          guardNav?.(href(SHELL_ROUTES.organization), e);
          onNavigate?.();
        }}
        aria-label="Mesita business console"
        title={collapsed ? "Mesita business" : undefined}
        className={cn(
          "inline-flex shrink-0 items-center",
          collapsed ? "justify-center" : "gap-2 px-1.5",
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
            <span className={TINY_LABEL_CLASS}>business</span>
          </>
        )}
      </Link>

      {/* WHICH ORGANIZATION. It scopes every row below it, so it sits above
          them. A <select> rather than a menu: keyboard- and screen-reader-
          native, and the rail has no room to reinvent one. One organization
          renders as a LABEL — in a rail the name is half the orientation. */}
      {!collapsed && (
        <div className="mt-3.5 shrink-0">
          {organizations.length > 1 ? (
            <select
              aria-label="Switch organization"
              value={activeOrgId ?? ""}
              onChange={(e) => {
                window.location.href = switchHref(e.target.value);
              }}
              className="border-sidebar-border bg-background text-foreground h-9 w-full truncate rounded-xl border px-2.5 text-[13px] font-semibold"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : (
            <p
              title={activeOrg?.name ?? undefined}
              className="text-foreground truncate px-2.5 text-[13px] font-semibold"
            >
              {activeOrg?.name ?? "No organization"}
            </p>
          )}
        </div>
      )}

      <nav
        aria-label="Console"
        className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        <NavRow
          href={href(SHELL_ROUTES.account)}
          label="Account"
          Icon={UserRound}
          active={pathname === SHELL_ROUTES.account}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        <NavRow
          href={href(SHELL_ROUTES.organization)}
          label="Organization"
          Icon={Building2}
          active={pathname === SHELL_ROUTES.organization}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />

        {/* THE PORTFOLIO. No label and no rule until there is something under
            them: an empty section is a promise the rail cannot keep, and a
            brand-new organization holds nothing. */}
        {places.length > 0 && (
          <>
            <SectionBreak label="Org Places" collapsed={collapsed} />
            {places.map((place) => (
              <div key={place.id} className="contents">
                {/* The place row is NEVER the active pill while its views
                    are showing. Its href is Profile's href, so pilling both
                    would paint two solid rows and two aria-current markers for
                    one location — and "you are here" stops meaning one row.
                    Open, it reads as the heading of its own group; closed, it
                    is an ordinary row like any other. */}
                <NavRow
                  href={withOrg(`/places/${encodeURIComponent(place.id)}`, activeOrgId)}
                  label={place.name}
                  title={place.name}
                  Icon={Store}
                  active={false}
                  heading={openPlaceId === place.id}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  onGuardedNavigate={guardNav ?? undefined}
                />
                {viewRows(place)}
              </div>
            ))}
          </>
        )}

        {/* Opened from All Places and held by someone else, or by nobody. It
            is not in the portfolio, so it says so by standing apart. */}
        {openIsForeign && openPlace && (
          <>
            <SectionBreak label={openPlace.name} collapsed={collapsed} />
            {viewRows(openPlace)}
          </>
        )}
      </nav>

      <div className="border-sidebar-border mt-2 shrink-0 border-t pt-2">
        {/* The superset, at the floor. You come here to claim something, not
            to work — so it is reachable, not prominent. */}
        <NavRow
          href={href(placesHref())}
          label="All Places"
          Icon={Layers}
          active={onPlacesList && owned === null}
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
              "mt-0.5 w-full",
              collapsed && "justify-center px-0 py-2",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
            )}
            <span className={collapsed ? "sr-only" : "truncate"}>Collapse</span>
          </button>
        )}
      </div>
    </aside>
  );
}

"use client";

// The whole navigation: one lateral rail. Client because active state needs
// usePathname and every href carries the active organization.
//
// THE RAIL LISTS THE PLACES THEMSELVES (MESITA-1715). A menu whose rows are
// the actual things beats a menu whose rows are links to lists of them — one
// click instead of two, and the portfolio is visible without navigating.
//
// ORDER, top to bottom (MESITA-1779, Pato's list): the wordmark, the
// organization switcher, then five things at ONE x — Account · Organization ·
// ORG PLACES (a toggle) · each place (a toggle) with its views beneath it ·
// a hairline · All Places — and the footer, which holds Collapse alone.
//
// ACCOUNT IS A ROW AGAIN. MESITA-1716 moved it to the footer so it would not
// read as a PAIR with Organization, and MESITA-1734 brought it back up as an
// avatar chip for the same reason. Pato listed it first (2026-09-12), so it
// is the first row — and the pair objection is answered by structure rather
// than by shape: the switcher sits between Account (who is looking) and
// Organization (what is on screen), so the two never share a group edge.
//
// FLAT, WITH TOGGLES. Nothing in this file indents — no inset, no tree line,
// no bullet, no `pl-8` — and `shell-chrome.test.ts` forbids all of them. An
// open place is told apart by its GROUND: the wrapper takes WELL_BG (the
// measured mix of the hover tint and the rail) with NO border, and its
// 2px inner padding is cancelled by a -2px margin so every row inside keeps
// the x of every row outside. MESITA-1734 drew a border around that well;
// Pato picked the borderless ground on the 2026-09-12 board, so the border is
// gone and the test now forbids it too.
//
// THE PORTFOLIO ARRIVES WITH THE ORGANIZATION. The rail used to fetch its
// places after hydration through a server action onto the states-matrix EF
// (p50 399 ms), so the portfolio popped in one round trip after the frame —
// or showed a Retry link when that call failed. `business-web-list-organizations`
// now ships each org's places and the viewer's super-admin flag; the server
// layout hands both here as props, and the first frame is the final frame.
//
// EVERY PLACE OPENS TO ITS VIEWS. A place's four views used to render only
// for the place whose layout had published them, so the chevron on any OTHER
// place opened an empty box — which is what "the buttons are not working"
// meant. The views are now derived for every held place from the viewer's
// org role and super-admin flag (`tabsForAccess`, the same matrix the place
// layout applies server-side). The place you are ON still shows its
// published set, because there the server has the last word.
//
// EXACTLY ONE FILLED PILL, IN EVERY STATE. Per-place toggles decouple open
// state from ROUTE state: collapse the place holding the current route and
// the pill — plus `aria-current="page"` — would vanish into a hidden subtree.
// A shut place that owns the route therefore carries the marker on its own
// header, with the view's name trailing. The same trap sits one level up:
// shut ORG PLACES while inside one of its places and the section keeps
// listing THAT place alone, so "you are here" survives every permutation.
//
// TWO TARGETS IN A PLACE'S HEADER (MESITA-1734 DQ-1). The name navigates —
// one click to a place. The chevron toggles and navigates nowhere, so it
// NEVER routes through the unsaved-edits guard: toggling discards nothing.
//
// NO TOGGLES WHEN COLLAPSED. At `w-16` there is no room for a name and a
// chevron, and a toggle with nothing to hide is ornament. The collapsed rail
// is the flat icon column: every place as a thumb, the current place's views
// beneath it.
//
// FASTER CLICKS. View rows prefetch their FULL route on hover
// (`unstable_dynamicOnHover`), so by the time the click lands the tab body is
// usually already here; the `loading.tsx` skeleton covers the rest. The org
// switcher navigates instead of reloading the whole document.
//
// LIGHT, not admin's dark slab. Every text token is a semantic pair with a
// measured ratio, never an opacity fraction. The well is a NEW ground, so
// `muted-foreground` on it is ~5.9:1 (measured 2026-09-10), not the rail's
// 6.31:1 — re-measure before darkening WELL_BG.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronRight,
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
import { useOpenPlace, useOpenPlaceGuard } from "@/components/console/OpenPlace";
import type { RailPlace } from "@/lib/api/organizations";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeHref,
  placeIdFromPathname,
  placesHref,
  withOrg,
} from "@/lib/console-routes";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  tabsForAccess,
  type PlaceTab,
} from "@/lib/place-tabs";
import { placeThumbUrl } from "@/lib/place-thumb";
import {
  RAIL_OPEN_PLACES_COOKIE,
  RAIL_PORTFOLIO_COOKIE,
  serializeOpenPlaceIds,
  serializePortfolioOpen,
} from "@/lib/sidebar-prefs";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { useActiveOrg, type RailOrg } from "@/lib/use-active-org";

type SidebarProps = {
  /** Each organization with the viewer's role and the places it holds. */
  organizations: RailOrg[];
  /** Whether the Admin view exists for this viewer, on every place. */
  isSuperAdmin: boolean;
  /** Closes the mobile drawer on navigation. Absent on the desktop rail. */
  onNavigate?: () => void;
  /** Icon-only rail. Desktop instance only — the drawer is always full. */
  collapsed?: boolean;
  /** Absent on the drawer instance, which has no collapsed state to toggle. */
  onToggleCollapse?: () => void;
  /** Which places were open when the operator last left, read from the
   *  cookie by the server layout so the column paints at its final height on
   *  the first frame. */
  defaultOpenPlaceIds?: string[];
  /** Whether ORG PLACES was open, same cookie trick. */
  defaultPortfolioOpen?: boolean;
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
  "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";
// The active row is a SOLID ink pill, not a tint. It is the one place in the
// rail where the console's foreground appears as a fill, which is what makes
// "you are here" survive a glance down a light column.
const ROW_ACTIVE = "bg-foreground text-background font-semibold";
// The open place's own row: it heads the views below it, so it goes bold
// without a fill. Exactly one filled pill on screen at a time.
const ROW_HEADING = "text-foreground font-semibold hover:bg-sidebar-accent";

// The open place's ground.
//
// A 50/50 mix of the hover tint and the rail, which lands at roughly
// oklch(0.965) — measurably darker than `--sidebar` (0.98) and measurably
// LIGHTER than `--sidebar-accent` (0.95), so a row inside the well still has
// somewhere to hover to. Both facts are load-bearing: identical to the rail
// and the well is invisible, identical to the hover and every row inside it
// looks permanently hovered. No border: the ground alone is the container,
// and it appears only where there is something to contain.
const WELL_BG =
  "bg-[color-mix(in_oklab,var(--color-sidebar-accent)_50%,var(--color-sidebar))]";

/** The rendered thumb box in CSS pixels, and what placeThumbUrl doubles for
 *  retina. Matches the `h-5 w-5` the row draws. */
const THUMB_PX = 20;

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
  /** This row owns the group below it. Reads as a heading, not a destination
   *  you are currently at — the pill belongs to one of its views. */
  heading = false,
  /** A place's own photo, already thumbnailed. Replaces the glyph when there
   *  is one; `Icon` is the fallback for a place with no photo yet. */
  thumb,
  /** Prefetch the whole route on hover, not just its loading boundary. On
   *  for the view rows, whose bodies wait on an Edge Function otherwise. */
  hoverPrefetch = false,
  onNavigate,
  onGuardedNavigate,
  title,
  className,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  heading?: boolean;
  thumb?: string | null;
  hoverPrefetch?: boolean;
  onNavigate?: () => void;
  onGuardedNavigate?: (href: string, e: { preventDefault: () => void }) => boolean;
  title?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      // The app-dir Link (what `next/link` resolves to inside app/) takes
      // `unstable_dynamicOnHover`; the public typing is still the pages one,
      // so the prop rides a spread rather than a cast on the whole element.
      {...(hoverPrefetch ? { unstable_dynamicOnHover: true } : {})}
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
        collapsed && "justify-center px-0 py-2",
        className,
      )}
    >
      {thumb ? (
        // Plain <img>, the same choice PlaceStatesTable and PlaceGallery make:
        // placeThumbUrl has already produced a 2x thumb of a few KB, so
        // next/image would add an optimizer hop for nothing. `alt=""` because
        // the label beside it already names the place — announcing the name
        // twice is noise on a screen reader, not access.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-5 w-5 shrink-0 rounded-md object-cover"
        />
      ) : (
        <Icon className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
      )}
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
  );
}

/** Groups without indenting, where there is nothing to toggle: the foreign
 *  place's own label, and the collapsed rail's rule (no room for words). */
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

/**
 * The eyebrow, made a disclosure: ORG PLACES with its count and a chevron.
 *
 * A <button>, never a link — the places themselves are the destinations, and
 * `placesHref("org")` stays banned from this rail (MESITA-1715). Not a NavRow
 * either: it carries no glyph and sits in the eyebrow's size and tracking, so
 * it cannot be mistaken for a row you can be "at". Full width, so the whole
 * line is the target and not just the chevron.
 */
function SectionToggle({
  label,
  count,
  open,
  onToggle,
  controls,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** The id of the list this toggle shows and hides. */
  controls: string;
}) {
  const verb = open ? "Collapse" : "Expand";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      aria-label={`${verb} ${label} (${count})`}
      title={`${verb} ${label}`}
      className={cn(
        "group mt-2.5 flex w-full min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-left transition lg:min-h-0 lg:h-7",
        "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        FOCUS_RING,
      )}
    >
      <span className={cn(TINY_LABEL_CLASS, "truncate group-hover:text-foreground")}>
        {label}
      </span>
      <span className="shrink-0 text-[10px] font-medium">· {count}</span>
      <ChevronRight
        className={cn(
          "ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out",
          open && "rotate-90",
        )}
      />
    </button>
  );
}

/**
 * One place: a header row you open and close, and its views beneath it.
 *
 * Composed from `NavRow` rather than rebuilt: the rail must keep exactly one
 * way to draw a row, or it grows two row systems that drift apart forever.
 *
 * The header is TWO controls sharing one line — a link that navigates and a
 * button that toggles — with independent hover surfaces, because a single
 * hover treatment across both would advertise one target where there are two.
 * When the header carries the active pill the WRAPPER takes the fill, so the
 * two controls read as the one pill they visually are.
 */
function PlaceRow({
  place,
  tabs,
  open,
  onToggle,
  activeTab,
  ownsRoute,
  organizationId,
  onNavigate,
  onGuardedNavigate,
}: {
  place: RailPlace;
  /** Exactly the views this viewer may open here: derived for a held place,
   *  published by the layout for the place you are on. */
  tabs: PlaceTab[];
  open: boolean;
  onToggle: () => void;
  activeTab: PlaceTab | null;
  /** This place owns the route currently on screen. */
  ownsRoute: boolean;
  organizationId: string | null;
  onNavigate?: () => void;
  onGuardedNavigate?: (href: string, e: { preventDefault: () => void }) => boolean;
}) {
  const viewsId = `rail-place-views-${place.id}`;
  const href = withOrg(placeHref(place.id), organizationId);
  const thumb = placeThumbUrl(place.photoUrl, THUMB_PX);

  // The pill is on the HEADER only when the place is shut on the route we are
  // looking at. Open, it belongs to the view row inside — painting both would
  // put two solid rows and two `aria-current` markers on screen for one
  // location, and "you are here" stops meaning one row.
  const headerIsActive = ownsRoute && !open;
  const showViews = open && tabs.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl transition-colors",
        // The ground is the container. The negative margin pays for the
        // padding exactly, so the rows inside keep the x of the rows outside.
        open && cn(WELL_BG, "-mx-0.5 p-0.5"),
      )}
    >
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-xl",
          headerIsActive && ROW_ACTIVE,
        )}
      >
        <NavRow
          href={href}
          label={place.name}
          title={place.name}
          Icon={Store}
          thumb={thumb}
          // The pill lives on the wrapper when it is on at all, so the link
          // itself never paints one — otherwise the fill would stop at the
          // chevron and the row would read as two objects.
          active={false}
          heading={open || headerIsActive}
          collapsed={false}
          onNavigate={onNavigate}
          onGuardedNavigate={onGuardedNavigate}
          className={cn(
            "min-w-0 flex-1",
            headerIsActive && "text-background hover:bg-transparent",
          )}
        />
        {/* The view you are on, named on the shut place that holds it. Without
            this the header says WHICH place is current but not which view, so
            collapsing a place would quietly cost you half your orientation.
            SIZE AND WEIGHT, NEVER AN ALPHA: 11px medium beside a 13px semibold
            name, on the same measured token. */}
        {headerIsActive && activeTab && (
          <span className="text-background shrink-0 truncate text-[11px] font-medium">
            {PLACE_TAB_LABEL[activeTab]}
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={showViews ? viewsId : undefined}
          // Named, not a bare glyph: "button, collapsed" tells a screen-reader
          // user nothing about WHAT collapses.
          aria-label={`${open ? "Collapse" : "Expand"} ${place.name}`}
          title={open ? `Collapse ${place.name}` : `Expand ${place.name}`}
          className={cn(
            // 44px on touch, where the chevron is a real target competing for
            // width with the name; tighter on the desktop rail, where it is
            // not. Below `lg` this leaves the name roughly 150px before it
            // truncates, which is the accepted cost of two targets in one row.
            "flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl transition lg:min-h-0 lg:h-7 lg:w-7",
            FOCUS_RING,
            headerIsActive
              ? "text-background hover:bg-background/15"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <ChevronRight
            className={cn(
              // The one authored motion moment in this rail, and it is
              // transform-only so it costs no layout.
              "h-4 w-4 transition-transform duration-150 ease-out lg:h-3.5 lg:w-3.5",
              open && "rotate-90",
            )}
          />
        </button>
      </div>

      {showViews && (
        <div id={viewsId} className="flex flex-col gap-0.5">
          {tabs.map((tab) => (
            <NavRow
              key={tab}
              href={placeTabHref(place.id, tab, organizationId)}
              label={PLACE_TAB_LABEL[tab]}
              Icon={TAB_ICON[tab]}
              active={activeTab === tab}
              collapsed={false}
              title={place.name}
              hoverPrefetch
              onNavigate={onNavigate}
              onGuardedNavigate={onGuardedNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const PORTFOLIO_ID = "rail-portfolio";

export function Sidebar({
  organizations,
  isSuperAdmin,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  defaultOpenPlaceIds = [],
  defaultPortfolioOpen = true,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // ONE resolver for every piece of chrome — see lib/use-active-org.ts.
  const { activeOrg, activeOrgId } = useActiveOrg(organizations);

  const owned = ownedFromParam(searchParams.get("owned"));
  const openPlace = useOpenPlace();
  const guardNav = useOpenPlaceGuard();
  const openPlaceId = placeIdFromPathname(pathname);
  const onPlacesList = pathname === SHELL_ROUTES.places;

  // THE PORTFOLIO IS A PROP. It rides the organization list the server layout
  // already fetches, so there is nothing to load, nothing to fail, and no
  // frame where the column is shorter than it will be.
  const places = activeOrg?.places ?? [];

  // WHICH PLACES ARE OPEN. Seeded from the cookie so the first painted frame
  // is already the right height, then owned here.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenPlaceIds),
  );

  const persistOpen = useCallback((next: Set<string>) => {
    // A year-long cookie rather than localStorage, for the same reason the
    // collapsed width uses one: the server layout reads it during render.
    document.cookie = `${RAIL_OPEN_PLACES_COOKIE}=${serializeOpenPlaceIds(next)}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const togglePlace = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        const next = new Set(prev);
        // Delete-then-add on reopen, so insertion order tracks recency and the
        // cookie's tail-keeping drops the place touched longest ago.
        if (next.has(id)) next.delete(id);
        else {
          next.delete(id);
          next.add(id);
        }
        persistOpen(next);
        return next;
      });
    },
    [persistOpen],
  );

  // WHETHER ORG PLACES IS OPEN. Open is the default and is stored as an
  // ABSENT cookie (max-age=0 expires it), so only a shut portfolio costs a
  // header on every request.
  const [portfolioOpen, setPortfolioOpen] = useState(defaultPortfolioOpen);
  const togglePortfolio = useCallback(() => {
    setPortfolioOpen((prev) => {
      const next = !prev;
      document.cookie = `${RAIL_PORTFOLIO_COOKIE}=${serializePortfolioOpen(next)}; path=/; max-age=${next ? 0 : 31536000}; samesite=lax`;
      return next;
    });
  }, []);

  // THE PLACE YOU NAVIGATE TO OPENS ITSELF, ONCE.
  //
  // Arriving at a place reveals its views — but only on the transition INTO
  // that place, tracked by a ref. Without the ref this effect would re-open
  // the place on the very next render after the operator collapsed it, and
  // the chevron would look broken.
  const autoOpened = useRef<string | null>(null);
  useEffect(() => {
    if (!openPlaceId) {
      autoOpened.current = null;
      return;
    }
    if (autoOpened.current === openPlaceId) return;
    autoOpened.current = openPlaceId;
    setOpenIds((prev) => {
      if (prev.has(openPlaceId)) return prev;
      const next = new Set(prev);
      next.add(openPlaceId);
      persistOpen(next);
      return next;
    });
  }, [openPlaceId, persistOpen]);

  const href = (to: string) => withOrg(to, activeOrgId);

  // Which of the place's views is open. Every view has a segment since
  // MESITA-1732, so this is a membership test rather than a bare-URL special
  // case, and it lives in ONE place (lib/place-tabs) that the page heading
  // reads too. An unknown segment lights up nothing instead of Profile.
  const activeTab: PlaceTab | null = openPlaceId
    ? placeTabFromPathname(pathname)
    : null;

  // A place you have open that this org does not hold — you reached it from
  // All Places. It is not in the list, so it gets its own break rather than
  // being silently missing from a rail that is showing you its views.
  const openIsForeign =
    openPlace != null &&
    openPlace.id === openPlaceId &&
    !places.some((p) => p.id === openPlace.id);

  // THE VIEWS OF EVERY HELD PLACE, without visiting any of them: the org role
  // and the super-admin flag decide, through the one matrix the place layout
  // applies server-side. Held by the active org means this viewer is a
  // member, so `held` is true for every place in the list.
  const derivedTabs = useMemo(
    () =>
      tabsForAccess({
        held: true,
        role: activeOrg?.myRole ?? null,
        isSuperAdmin,
      }),
    [activeOrg?.myRole, isSuperAdmin],
  );
  // The place you are ON shows what its layout PUBLISHED — the server's
  // answer, which also covers a foreign place the derivation cannot.
  const tabsFor = useCallback(
    (id: string): PlaceTab[] =>
      openPlace?.id === id ? openPlace.tabs : derivedTabs,
    [openPlace, derivedTabs],
  );

  const rowProps = useMemo(
    () => ({
      organizationId: activeOrgId,
      onNavigate,
      onGuardedNavigate: guardNav ?? undefined,
      activeTab,
    }),
    [activeOrgId, onNavigate, guardNav, activeTab],
  );

  const switchHref = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("org", id);
    return `${pathname}?${params.toString()}`;
  };

  // A SHUT PORTFOLIO STILL SHOWS WHERE YOU ARE. Hiding every place would hide
  // the pill and `aria-current` with it, so the place that owns the route
  // stays listed on its own; every other place is what the toggle hides.
  const listed = portfolioOpen
    ? places
    : places.filter((p) => p.id === openPlaceId);

  // COLLAPSED IS THE ICON COLUMN. `w-16` cannot hold a name and a chevron, so
  // there are no toggles here at all — every place is a thumb row and the
  // place you are on shows its views beneath it.
  const renderPlace = (place: RailPlace) => {
    if (collapsed) {
      const tabs = openPlaceId === place.id ? tabsFor(place.id) : [];
      return (
        <div key={place.id} className="contents">
          <NavRow
            href={href(placeHref(place.id))}
            label={place.name}
            title={place.name}
            Icon={Store}
            thumb={placeThumbUrl(place.photoUrl, THUMB_PX)}
            active={false}
            heading={openPlaceId === place.id}
            collapsed
            onNavigate={onNavigate}
            onGuardedNavigate={guardNav ?? undefined}
          />
          {tabs.map((tab) => (
            <NavRow
              key={tab}
              href={placeTabHref(place.id, tab, activeOrgId)}
              label={PLACE_TAB_LABEL[tab]}
              Icon={TAB_ICON[tab]}
              active={activeTab === tab}
              collapsed
              title={place.name}
              hoverPrefetch
              onNavigate={onNavigate}
              onGuardedNavigate={guardNav ?? undefined}
            />
          ))}
        </div>
      );
    }
    return (
      <PlaceRow
        key={place.id}
        place={place}
        tabs={tabsFor(place.id)}
        open={openIds.has(place.id)}
        onToggle={() => togglePlace(place.id)}
        ownsRoute={openPlaceId === place.id && activeTab !== null}
        {...rowProps}
      />
    );
  };

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      {/* THE TOP LINE: the product. Who you are is the first row below. */}
      <div
        className={cn(
          "flex shrink-0 items-center",
          collapsed ? "justify-center" : "px-1.5",
        )}
      >
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
              <span className={TINY_LABEL_CLASS}>business</span>
            </>
          )}
        </Link>
      </div>

      {/* WHICH ORGANIZATION. It scopes every row below it, so it sits above
          them. A <select> rather than a menu: keyboard- and screen-reader-
          native, and the rail has no room to reinvent one. One organization
          renders as a LABEL — in a rail the name is half the orientation.
          Switching NAVIGATES: every page re-reads `?org=` on the server and
          the rail re-resolves from the same props, so a whole-document reload
          would only throw away the shell it is about to draw again. */}
      {!collapsed && (
        <div className="mt-3.5 shrink-0">
          {organizations.length > 1 ? (
            <select
              aria-label="Switch organization"
              value={activeOrgId ?? ""}
              onChange={(e) => {
                router.push(switchHref(e.target.value));
              }}
              className={cn(
                "border-sidebar-border bg-background text-foreground h-9 w-full truncate rounded-xl border px-2.5 text-[13px] font-semibold",
                FOCUS_RING,
              )}
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

        {/* THE PORTFOLIO. No toggle and no rule until there is something under
            them: an empty section is a promise the rail cannot keep, and a
            brand-new organization holds nothing. */}
        {places.length > 0 &&
          (collapsed ? (
            <>
              <SectionBreak label="Org Places" collapsed />
              {places.map(renderPlace)}
            </>
          ) : (
            <>
              <SectionToggle
                label="Org Places"
                count={places.length}
                open={portfolioOpen}
                onToggle={togglePortfolio}
                controls={PORTFOLIO_ID}
              />
              {listed.length > 0 && (
                <div id={PORTFOLIO_ID} className="flex flex-col gap-0.5">
                  {listed.map(renderPlace)}
                </div>
              )}
            </>
          ))}

        {/* Opened from All Places and held by someone else, or by nobody. It
            is not in the portfolio, so it says so by standing apart. */}
        {openIsForeign && openPlace && (
          <>
            <SectionBreak label={openPlace.name} collapsed={collapsed} />
            {/* The layout publishes a name, not a photo, so a foreign place
                wears the Store glyph — it is a visitor here, not a portfolio
                row, and the break above already names it. */}
            {renderPlace({ id: openPlace.id, name: openPlace.name, photoUrl: null })}
          </>
        )}

        {/* Closes the places area. THE HAIRLINE IS LOAD-BEARING: a run of
            places followed by an uncontained row of the same width reads as
            one group, and All Places is a link to a list, not one of the
            places above it. The rule says "this is not one of them." */}
        <div className="border-sidebar-border mx-2 mt-3 mb-1 border-t" />
        <NavRow
          href={href(placesHref())}
          label="All Places"
          Icon={Layers}
          active={onPlacesList && owned === null}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
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
              <PanelLeftOpen className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
            )}
            <span className={collapsed ? "sr-only" : "truncate"}>Collapse</span>
          </button>
        </div>
      )}
    </aside>
  );
}

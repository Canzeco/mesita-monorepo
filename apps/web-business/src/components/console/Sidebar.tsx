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
// ORDER, top to bottom: the wordmark (with Account riding its right edge),
// the organization switcher, Organization, the org's places as boxes, a
// hairline, All Places — then the footer, which holds Collapse alone.
//
// ACCOUNT IS AT THE TOP, AND IT IS NOT A ROW (MESITA-1734, reworking 1716).
// Pato: "Account must be at the top." 1716 had pushed it to the footer for a
// real reason — beside Organization it read as a PAIR, and the two are not
// one: Organization is the entity whose data is on screen, Account is who is
// looking at it. Moving the same row back up would rebuild that pair exactly.
//
// So it moves up as a DIFFERENT KIND OF OBJECT: a 24px round identity button
// on the wordmark's right edge. Top of the column, zero rows consumed, and
// nothing about it rhymes with a nav row — so it cannot pair with one. It also
// stays out of the way of prominence: on a console an operator lives in all
// day, their own identity is the least informative pixel on screen, and a
// full-width identity row at the top would outrank both the organization and
// the places it is supposed to sit above.
//
// A GLYPH, NOT A PHOTO, for now: the rail is handed `organizations` and
// nothing about the viewer, so an avatar image would mean threading the user
// through `(shell)/layout.tsx` for 24 pixels. When that thread exists, this is
// the element that wears it.
//
// PLACES ARE BOXES, AND A BOX IS NOT A TREE (MESITA-1734). MESITA-1714 and
// 1715 made this rail flat and Pato rejected the nested version on sight,
// twice. That rejection was about INDENTATION as the grouping mechanism, and
// it was right: the active row is almost always a leaf, so grouping by indent
// puts the most important row on screen at the deepest inset and inverts
// hierarchy.
//
// A box does not indent. It groups by common region — a shared edge and
// ground — so the four view rows inside a place box sit at the SAME left
// inset as every row outside it. Same grouping goal, none of the indent cost.
// `inset`/`pl-8` is gone from this file entirely and `shell-chrome.test.ts`
// still forbids it: containers group, insets never do.
//
// EXACTLY ONE FILLED PILL, IN EVERY STATE. Per-place toggles decouple box
// state from ROUTE state, and that is the trap: collapse the box holding the
// current route and the pill — plus `aria-current="page"` — disappear into a
// hidden subtree, so sighted and screen-reader users lose "you are here"
// identically. A collapsed box whose place owns the current route therefore
// carries the marker on its own header, with the view's name as a trailing
// label. Open the box and the pill hands off to the view row inside.
//
// TWO TARGETS IN THE HEADER (Pato, MESITA-1734 DQ-1). The name navigates —
// one click to a place, exactly as before. The chevron toggles and navigates
// nowhere, so it NEVER routes through the unsaved-edits guard: toggling a box
// discards nothing, and offering "discard your edits" for it would be an
// offer to throw work away for nothing.
//
// NO BOXES WHEN COLLAPSED. At `w-16` there is no room for a container, a
// thumb, a name and a chevron, and a container with nothing to contain is
// ornament. The collapsed rail keeps the flat icon rows it has always had.
//
// THERE IS NO PUBLIC PLACES ROW. Org places are a SUBSET of All Places, and a
// subset earns a row. Public is the COMPLEMENT — All minus Org — which is
// exactly the fact the Owned column already carries on every row of the list.
// Giving a complement a row makes a filter look like a place, which is the
// mistake MESITA-1614 unwound. `?owned=public` still resolves, so a bookmark
// keeps working; it stopped being a destination, not a capability.
//
// EVERY PLACE WEARS ITS OWN PHOTO. A portfolio of six identical Store glyphs
// is six copies of one row with different words on them; an owner knows their
// places by sight before they know them by name. Always through
// `placeThumbUrl()` — `photoUrl` is a full-resolution original, and pointing
// an <img> at one is the mistake MESITA-1553 fixed on the list rows. The rail
// is on every screen, so it would be a worse mistake here.
//
// LIGHT, not admin's dark slab. Every text token is a semantic pair with a
// measured ratio, never an opacity fraction — admin's rail ships three AA
// failures that way. The open box's well is a NEW ground, so its ratio is
// measured against the well and not inherited from `--sidebar`; see WELL_BG.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronRight,
  FileText,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
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
import {
  listRailPlacesAction,
  type RailPlace,
} from "@/app/(shell)/actions/places";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeHref,
  placeIdFromPathname,
  placesHref,
  withOrg,
} from "@/lib/console-routes";
import { PLACE_TAB_LABEL, placeTabFromPathname, placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { placeThumbUrl } from "@/lib/place-thumb";
import {
  RAIL_OPEN_PLACES_COOKIE,
  serializeOpenPlaceIds,
} from "@/lib/sidebar-prefs";
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
  /** Which place boxes were open when the operator last left, read from the
   *  cookie by the server layout so the column paints at its final height on
   *  the first frame. */
  defaultOpenPlaceIds?: string[];
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
const ROW_HEADING = "text-foreground font-semibold hover:bg-sidebar-accent";

// The open box's ground.
//
// A 50/50 mix of the hover tint and the rail, which lands at roughly
// oklch(0.965) — measurably darker than `--sidebar` (0.98) and measurably
// LIGHTER than `--sidebar-accent` (0.95), so a row inside the well still has
// somewhere to hover to. Both facts are load-bearing: identical to the rail
// and the well is invisible, identical to the hover and every row inside it
// looks permanently hovered.
//
// CONTRAST IS RE-MEASURED, NOT INHERITED. `muted-foreground` (oklch 0.48) is
// documented at 6.31:1 against `--sidebar`; against this well it is ~5.9:1.
// Still comfortably past AA, but the number is different, and the rail's rule
// is that every text token is a semantic pair with a MEASURED ratio. Darken
// this mix and re-measure before shipping it.
//
// The tint is not what makes it a container — the hairline is. That is why
// the tint can stay this quiet: `CLAUDE.md` says business surfaces are calm
// and high-density, and a well loud enough to read as a card on its own would
// turn a portfolio into the dashboard-card mosaic this design avoids.
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
  onNavigate?: () => void;
  onGuardedNavigate?: (href: string, e: { preventDefault: () => void }) => boolean;
  title?: string;
  className?: string;
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

/**
 * One place, as a module you open and close.
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
function PlaceBox({
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
  place: { id: string; name: string; photoUrl?: string | null };
  /** Exactly the views this viewer may open. Empty until the place layout
   *  publishes them, which is why a box for a place you are not on shows a
   *  header and nothing else. */
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

  // The pill is on the HEADER only when the box is shut on the route we are
  // looking at. Open, it belongs to the view row inside — painting both would
  // put two solid rows and two `aria-current` markers on screen for one
  // location, and "you are here" stops meaning one row.
  const headerIsActive = ownsRoute && !open;
  const showViews = open && tabs.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        // The hairline is what makes it a container; the tint only supports it.
        open && cn(WELL_BG, "border-sidebar-border border"),
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
        {/* The view you are on, named on the shut box that holds it. Without
            this the header says WHICH place is current but not which view, so
            collapsing a box would quietly cost you half your orientation. */}
        {/* SIZE AND WEIGHT, NEVER AN ALPHA. `text-background/80` would be a
            contrast ratio nobody computed, which is exactly how admin's rail
            shipped three AA failures — `AppShell.test.ts` bans the whole
            family. The label steps back by being 11px medium beside a 13px
            semibold name, on the same measured token. */}
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
            headerIsActive
              ? "text-background hover:bg-background/15"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <ChevronRight
            className={cn(
              // The one authored motion moment in this rail, and it is
              // transform-only so it costs no layout. `motion-reduce` keeps
              // the rotation (it moves nothing on the page) but the height
              // easing below is dropped.
              "h-4 w-4 transition-transform duration-150 ease-out lg:h-3.5 lg:w-3.5",
              open && "rotate-90",
            )}
          />
        </button>
      </div>

      {showViews && (
        <div id={viewsId} className="flex flex-col gap-0.5 px-1 pb-1">
          {tabs.map((tab) => (
            <NavRow
              key={tab}
              href={placeTabHref(place.id, tab, organizationId)}
              label={PLACE_TAB_LABEL[tab]}
              Icon={TAB_ICON[tab]}
              active={activeTab === tab}
              collapsed={false}
              title={place.name}
              onNavigate={onNavigate}
              onGuardedNavigate={onGuardedNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  organizations,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  defaultOpenPlaceIds = [],
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
    rows: RailPlace[];
    failed: boolean;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!activeOrgId) return;
    let live = true;
    listRailPlacesAction(activeOrgId).then((result) => {
      if (live) {
        setFetched({
          orgId: activeOrgId,
          rows: result.places,
          failed: result.failed,
        });
      }
    });
    return () => {
      live = false;
    };
    // portfolioVersion is the claim/release signal — see PlaceHoldButton.
  }, [activeOrgId, portfolioVersion, reloadKey]);
  const loaded = fetched?.orgId === activeOrgId;
  const places = loaded ? fetched.rows : [];
  const failed = loaded && fetched.failed;

  // WHICH BOXES ARE OPEN. Seeded from the cookie so the first painted frame is
  // already the right height, then owned here.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenPlaceIds),
  );

  const persist = useCallback((next: Set<string>) => {
    // A year-long cookie rather than localStorage, for the same reason the
    // collapsed width uses one: the server layout reads it during render.
    document.cookie = `${RAIL_OPEN_PLACES_COOKIE}=${serializeOpenPlaceIds(next)}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const toggleBox = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        const next = new Set(prev);
        // Delete-then-add on reopen, so insertion order tracks recency and the
        // cookie's tail-keeping drops the box touched longest ago.
        if (next.has(id)) next.delete(id);
        else {
          next.delete(id);
          next.add(id);
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // THE PLACE YOU NAVIGATE TO OPENS ITSELF, ONCE.
  //
  // Before boxes, arriving at a place always revealed its views; losing that
  // would make the rail worse for the sake of the new control. So arriving
  // opens the box — but only on the transition INTO that place, tracked by a
  // ref. Without the ref this effect would re-open the box on the very next
  // render after the operator collapsed it, and the chevron would look broken.
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
      persist(next);
      return next;
    });
  }, [openPlaceId, persist]);

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

  // The views a given place can show. Only the place you are ON has published
  // them, so every other box is a header alone — which is correct: the rail
  // cannot know a viewer's permissions for a place they have not opened, and
  // guessing four rows that might 403 is worse than showing none.
  const tabsFor = useCallback(
    (id: string): PlaceTab[] =>
      openPlace?.id === id ? openPlace.tabs : [],
    [openPlace],
  );

  const boxProps = useMemo(
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

  // COLLAPSED IS THE OLD RAIL. `w-16` cannot hold a container, a thumb, a name
  // and a chevron, so there are no boxes here at all — the places are flat
  // icon rows and the place you are on shows its views beneath it, exactly as
  // this rail behaved before MESITA-1734.
  const renderPlace = (place: RailPlace | { id: string; name: string; photoUrl?: string | null }) => {
    if (collapsed) {
      const tabs = tabsFor(place.id);
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
              onNavigate={onNavigate}
              onGuardedNavigate={guardNav ?? undefined}
            />
          ))}
        </div>
      );
    }
    return (
      <PlaceBox
        key={place.id}
        place={place}
        tabs={tabsFor(place.id)}
        open={openIds.has(place.id)}
        onToggle={() => toggleBox(place.id)}
        ownsRoute={openPlaceId === place.id && activeTab !== null}
        {...boxProps}
      />
    );
  };

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      {/* THE TOP LINE: the product on the left, who you are on the right. */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          collapsed ? "flex-col" : "px-1.5",
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
            "inline-flex min-w-0 items-center",
            collapsed ? "justify-center" : "flex-1 gap-2",
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

        {/* ACCOUNT. An avatar, not a row — see the docblock. It rides the
            wordmark's right edge expanded, and drops under the mark when the
            rail is 64px wide and there is no "right edge" to ride. */}
        <Link
          href={href(SHELL_ROUTES.account)}
          onClick={(e) => {
            guardNav?.(href(SHELL_ROUTES.account), e);
            onNavigate?.();
          }}
          aria-current={pathname === SHELL_ROUTES.account ? "page" : undefined}
          aria-label="Account"
          title="Account"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition",
            // ROW_ACTIVE, not a second spelling of it. The rail has exactly one
            // definition of "filled", and re-typing the pair here is how a
            // second one starts — the same reason the collapsed cookie name
            // stopped being a literal in AppShell.
            pathname === SHELL_ROUTES.account
              ? ROW_ACTIVE
              : "border-sidebar-border text-muted-foreground hover:border-foreground/40 hover:text-foreground border",
            collapsed && "mt-3",
          )}
        >
          <UserRound className="h-3.5 w-3.5" />
        </Link>
      </div>

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
            <div className="flex flex-col gap-1">{places.map(renderPlace)}</div>
          </>
        )}

        {/* THE LIST FAILED, AND SAYS SO (MESITA-1734). This used to render
            identically to an organization holding no places — silently, and
            permanently, because nothing retries a resolved promise. Retry
            re-runs the action rather than reloading the console. */}
        {failed && !collapsed && (
          <div className="mt-3 px-2.5">
            <p className="text-muted-foreground text-[12px]">
              Couldn&apos;t load places.
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-foreground mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold underline underline-offset-2"
            >
              <RotateCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
        {failed && collapsed && (
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Retry loading places"
            title="Couldn't load places — retry"
            className={cn(ROW_BASE, ROW_REST, "justify-center px-0 py-2")}
          >
            <RotateCw className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
          </button>
        )}

        {/* Opened from All Places and held by someone else, or by nobody. It
            is not in the portfolio, so it says so by standing apart. */}
        {openIsForeign && openPlace && (
          <>
            <SectionBreak label={openPlace.name} collapsed={collapsed} />
            {renderPlace(openPlace)}
          </>
        )}

        {/* Closes the places area. A place list belongs with place lists — it
            used to sit in the footer beside Account, which put a catalogue
            and an identity in one group.

            THE HAIRLINE IS LOAD-BEARING (MESITA-1734): a stack of containers
            followed by an uncontained row of the same width reads as one
            group, and All Places is a link to a list, not one of the places
            above it. Containment says "these are places"; the rule says "this
            is not one of them." */}
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

      {/* THE FOOTER IS THE RAIL'S OWN CONTROL, AND ONLY THAT. Account left it
          for the top (MESITA-1734); what remains is the one button that acts
          on the rail rather than navigating anywhere. */}
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

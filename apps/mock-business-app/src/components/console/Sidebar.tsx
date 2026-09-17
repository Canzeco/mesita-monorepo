"use client";

// THE RAIL. One dark column, a head, a venue, FIVE rows, a foot.
//
// ── THE SHAPE (MESITA-1937) ───────────────────────────────────────────────
//
//   ┌──────────────────┐
//   │  mesita.         │  the HEAD: the lockup, pinned, scrolls with nothing
//   ├──────────────────┤
//   │  ▣ Lumbre y Sal ⌄│  the VENUE: the subject. Name → Home, caret → places
//   │  ▦ Products      │  ┐
//   │  ▤ Profile       │  │
//   │  ▧ Customers     │  │ THE FIVE. The only thing that scrolls, and every
//   │  ▥ Activity      │  │ row of it is about the venue named above.
//   │  ⚙ Settings      │  ┘
//   │                  │  the slack falls HERE, between the place and you
//   ├──────────────────┤
//   │  ⬤ Account       │  the FOOT: the PERSON, pinned
//   └──────────────────┘
//
// Pato, 2026-09-16, with the shipped rail on screen: *"Noooo — make it like
// this: Logo / Place Explorer-Selector / Products / Profile / Customers /
// Activity / Settings / (gap) / Account. keep congruent simple design."*
//
// ── THE THREE BANDS ────────────────────────────────────────────────────────
//
// THE HEAD SAYS THE PRODUCT, THE SCROLLER SAYS THE PLACE, THE FOOT SAYS THE
// PERSON. Each band answers a different question, so none can be mistaken for a
// row of another's list — which is why the logo is not the first entry in
// `RAIL_ROWS` and Account is not the last one.
//
// THE SCOPE IS THE DIVIDER, NOT THE SUBJECT MATTER (MESITA-1937). MESITA-1935
// read Settings and Account as two rows that both meant configuration and
// merged them; they are not. Settings configures the PLACE — Team and
// Developers at `/places/<id>/settings` — and Account is YOU, across every
// place you hold. Scoping them apart is what makes each one legible; the seam
// above the foot is where the scope changes, and it is the only seam left.
//
// THE EXIT IS ON THE FOOT, WHICH IS WHY THE FOOT IS ACCOUNT. `showRows` draws
// `RAIL_ROWS` only in the `solo` and `multi` shapes; `unknown` and `zero` get
// one button and no rows. This band renders in all four, and Sign out lives on
// its page and nowhere else — so whatever the scroller is doing, and whatever
// went wrong with the places, the person can still leave. A Settings row in the
// scroller is fine precisely because Settings is not where Sign out is.
//
// THE VENUE IS NOT A ROW EITHER, and it is not the selector returning
// (MESITA-1918 deleted a MENU). It is the SUBJECT of the column: the one thing
// in the rail that says which venue the five rows are about — Pato's "Place
// Explorer/Selector". Two SIBLING links, never nested — nested interactive
// elements are invalid and the inner one is unreachable by keyboard:
//
//   the photo and the name  → the place's bare address, which is HOME
//   the caret              → the catalogue, which is what switches places
//
// HOME KEEPS THE SCREEN AND LOSES THE ROW. The venue row is its door, and the
// pill lights on it there, which is how an operator learns that. MESITA-1914's
// rule holds — the console still opens on Home — without a sixth row naming an
// address the venue already names.
//
// THE SLACK BELONGS TO THE MIDDLE. The foot is pinned rather than trailing the
// rows, so a console with one row and a console with five put the person in the
// same place. A footer that floats up under a short list is how an operator
// learns to hunt for their own name.
//
// ── THE LAWS IT KEEPS ──────────────────────────────────────────────────────
//
// ONE COLUMN, FROM ONE ARRAY. Every row comes from `RAIL_ROWS`; there is no
// second list anywhere. Moving a row is an edit to one line in
// lib/console-routes.ts.
//
// ONE ROW SHAPE. No indent, one glyph, one label, no id, no count, no badge.
// The section HEADS are gone with the sections (MESITA-1933): a title over a
// handful of rows is a taxonomy drawn over a list.
//
// ROWS NEVER DIM. A product that is not live still gets a live page, and the
// PAGE says it is not here yet (SoonStrip). A dimmed row makes the column a
// place where some entries are real and some are not.
//
// ONE WIDTH. There is no chips-only rail and no control to reach one
// (MESITA-1905). The rail is `w-60` on desktop and the drawer below `lg`.
//
// HIDDEN IS NOT PROTECTED, AND IT IS NOT THE GATE EITHER. `tabsForAccess` and
// `pagesForAccess` drop the rows a viewer may not see; the `[view]` gate and
// each page's own `notFound` are what actually refuse the address. Until
// MESITA-1933 the product rows were running the only role check the console
// had, which is why the second matrix now exists.
//
// THE DARK GROUND IS ITS OWN VOCABULARY. `--sidebar-*` only, including the
// focus ring: the page's `--ring` is the brand pink drawn against a light
// background, and the rail has `--sidebar-ring` for the same reason it has its
// own foreground. Do not unify them.
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesColumn,
  ChevronDown,
  LayoutGrid,
  Plus,
  RotateCw,
  Settings,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { PlaceChip } from "@/components/console/PlaceChip";
import {
  PLACE_PAGE_LABEL,
  RAIL_ROWS,
  SHELL_ROUTES,
  flatPlacePageFromPathname,
  isPlaceHomePathname,
  placePageFromPathname,
  placePageHref,
  placeRootHref,
  type PlacePage,
  type PlaceRailView,
} from "@/lib/console-routes";
import {
  PLACE_TAB_LABEL,
  pagesForAccess,
  placeTabFromPathname,
  placeTabHref,
  tabsForAccess,
  type PlaceTab,
} from "@/lib/place-tabs";
import { flatViewFromPathname } from "@/lib/console-routes";
import type { RailScope } from "@/lib/rail-scope";
import { cn } from "@/lib/utils";

// ONE SIZE, AND IT IS THE BIG ONE (MESITA-1956). Pato: *"sidebar menu items
// more bigger"*, then *"make sidebar menu font bigger"*. The rail used to
// SHRINK on desktop — 14px glyph and 13px label under a cursor, 16px and 14px
// under a finger — which is backwards twice over: the desktop rail is the
// column you scan all day, and it had the smallest type in the app sitting on
// the darkest ground, where contrast sensitivity is already worst.
//
// THE GLYPH STOPS AT 20px while the label sits at 15px: the ask was the FONT
// both times, and a mark that scales with it gives back the scannability the
// icons are carrying on a dark column.
const ICON = "h-5 w-5 shrink-0";

// 15px, NOT 17 (MESITA-1957). Pato, once he could finally see it: *"maybe
// font smaller now, since words are a bit larger"*. 17px was one step past
// the target — a rail row is a LABEL, not body copy, and at 17px on a 223px
// column six words stop reading as a list of destinations and start reading
// as content, which is the same failure as 13px from the other side.
//
// THE `lg:` DOWNSHIFTS STAY DELETED, and that is the part that matters. The
// defect MESITA-1956 fixed was the rail being a DIFFERENT size on desktop
// than on a phone — 13px under a cursor, 14px under a finger. One size at
// every width is the rule; 15px is only where that one size sits. `min-h-11`
// still holds the 44px touch target on a phone; desktop reaches the same row
// height through `lg:py-2.5` instead.
const ROW_BASE =
  "flex items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition min-h-11 lg:min-h-0 lg:py-2.5 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";
const ROW_REST =
  "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground";
// The active row is a SOLID pill, not a tint: on the dark rail it is the
// off-white fill with ink text — the brightest thing in the column, which is
// what makes "you are here" survive a glance down it.
const ROW_ACTIVE = "bg-sidebar-foreground text-sidebar font-semibold";
const SECTION_SEAM = "border-sidebar-border/50 mt-2 border-t pt-2";

// THE VENUE'S TWO TARGETS. They share a flex line and nothing else: each keeps
// its own hit area and its own ring, because a row with one ring around two
// destinations tells a keyboard which one it is on by lying.
const VENUE_LINE = "flex items-center gap-1";
// THE VENUE RISES WITH THE ROWS, and by the same amount — it was already one
// step heavier than a nav row (semibold, tracking-tight) and that step is the
// whole hierarchy of the column. Left behind, the place NAME would end up
// smaller than the links under it.
const VENUE_NAME =
  "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold tracking-tight transition min-h-11 lg:min-h-0 lg:py-2 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring";
// 44×44 under the finger, 32×32 under the cursor. A caret sized to the glyph
// it draws is a 14px target, which is the whole reason this constant exists.
const VENUE_CARET =
  "flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl transition lg:h-8 lg:min-h-0 lg:w-8 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring";

// THE MARKS NAME THE SUBJECT, NOT THE LABEL:
//   Settings  Settings           the cog. The foot does NOT wear it any more
//                                (MESITA-1937): the foot is the person, and
//                                it wears UserRound
//   Customers Users              PEOPLE, plural — the pairing IS the meaning
//   Products  LayoutGrid         the CATALOGUE: a grid of tiles, which is
//                                literally what the page is
//   Activity  ChartNoAxesColumn  counts over time; a squiggle reads medical
//   Profile   Store              the PLACE's public page, not a document
//
// EXHAUSTIVE OVER `PlacePage`, AND AS OF MESITA-1937 EVERY ENTRY DRAWS A ROW.
// It stayed exhaustive through two issues where two of them did not — Customers
// left with the eight products (MESITA-1933) and Settings left for the foot
// (MESITA-1935) — which is exactly why both marks were still here to use. Keep
// it exhaustive: a page added to the contract has to pick a mark rather than
// render blank the day it gets a row.
const PAGE_ICON: Record<PlacePage, React.ComponentType<{ className?: string }>> = {
  settings: Settings,
  products: LayoutGrid,
  customers: Users,
  activity: ChartNoAxesColumn,
};

/** The one view that kept a row. It wears the mark its own catalogue CARD
 *  wears — one product drawn two ways is how an operator learns to distrust
 *  both drawings — and the card's tint does not come along: the only colour in
 *  this column is the pill. */
const VIEW_ICON: Record<PlaceRailView, React.ComponentType<{ className?: string }>> = {
  profile: Store,
};

function NavRow({
  href,
  label,
  Icon,
  active,
  onNavigate,
  title,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
  title?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      // Only a GIVEN title renders one. The label is on screen at every width
      // this rail has, so a tooltip repeating it would be a second copy of the
      // row's own text.
      title={title}
      className={cn(ROW_BASE, active ? ROW_ACTIVE : ROW_REST)}
    >
      <Icon className={ICON} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** A row that is a FACT, not a link: the places could not be read. */
function MutedRow({
  label,
  Icon,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div role="status" className={cn(ROW_BASE, "text-sidebar-muted")}>
      <Icon className={ICON} />
      <span className="truncate">{label}</span>
    </div>
  );
}

/** THE VENUE — the subject of the column, and Home's door.
 *
 *  A PHOTO, NEVER AN ICON: an icon is identical on every venue, and the whole
 *  job of this band is to say WHICH one the five rows below are about.
 *
 *  THE CARET IS NOT A MENU. It is a link to the catalogue — the surface that
 *  has done the switching since MESITA-1918 — and it renders at every mode,
 *  because at one place the catalogue is still the pool and the Add door. It
 *  replaces the `multi`-only All places row, which was the same door drawn
 *  twice at one of the four shapes. */
function VenueRow({
  placeId,
  name,
  photoUrl,
  onHome,
  onNavigate,
}: {
  placeId: string;
  name: string;
  photoUrl: string | null;
  onHome: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={VENUE_LINE}>
      <Link
        href={placeRootHref(placeId)}
        onClick={onNavigate}
        aria-current={onHome ? "page" : undefined}
        title={`Home · ${name}`}
        className={cn(VENUE_NAME, onHome ? ROW_ACTIVE : ROW_REST)}
      >
        <PlaceChip photoUrl={photoUrl} />
        <span className="truncate">{name}</span>
      </Link>
      <Link
        href={SHELL_ROUTES.places}
        onClick={onNavigate}
        aria-label="All places"
        title="All places"
        className={cn(VENUE_CARET, ROW_REST)}
      >
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      </Link>
    </div>
  );
}

export function Sidebar({
  scope,
  isSuperAdmin,
  viewerLabel,
  onNavigate,
  onRetry,
}: {
  scope: RailScope;
  // NO `places` (MESITA-1918): the rail took the whole portfolio only to fill
  // the selector's menu. It needs the SCOPE now — which venue is open, and
  // what this viewer may see of it.
  isSuperAdmin: boolean;
  /** The person's own name, for the foot row's tooltip only. */
  viewerLabel: string;
  onNavigate?: () => void;
  onRetry: () => void;
}) {
  const pathname = usePathname();
  const place = scope.place;
  const placeId = place?.id ?? null;

  const currentView: PlaceTab | null =
    placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname);
  const currentPage: PlacePage | null =
    placePageFromPathname(pathname) ?? flatPlacePageFromPathname(pathname);

  const onAccount = pathname === SHELL_ROUTES.account;
  const onAddPlace = pathname === SHELL_ROUTES.placesNew;

  // WHICH ROWS THIS CALLER MAY SEE, from ONE access object and TWO matrices.
  // The matrices are applied to the SELECTED place's own role, so switching
  // from a place you own to one you only view drops FOUR of the five rows and
  // leaves Profile — which is the honest picture, not a bug.
  //
  // TWO, because a page is not a view. `tabsForAccess` was the only role check
  // the rail ran, and it only ever saw the product rows; with those gone it
  // would have had nothing left to filter while every page row stayed open to
  // a viewer, with every check green (MESITA-1933). Four of the five rows are
  // pages now, so `pagesForAccess` is carrying almost all of this.
  const allowed = useMemo(() => {
    const access = {
      held: place !== null,
      role: place?.myRole ?? null,
      isSuperAdmin,
    };
    return {
      views: new Set<PlaceTab>(tabsForAccess(access)),
      pages: new Set<PlacePage>(pagesForAccess(access)),
    };
  }, [place, isSuperAdmin]);

  // THE FOUR SHAPES. `unknown` is NOT `zero` with a sad face: it offers a
  // retry and never the word "add", because a failed read has not established
  // that the caller holds nothing.
  const showRows = (scope.mode === "solo" || scope.mode === "multi") && placeId !== null;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-3 pb-3">
      {/* THE HEAD. The lockup is a LABEL, not a link: every address this rail
          reaches is below it, and a logo that navigates somewhere would be
          one more destination wearing different clothes. It takes the rail's own
          foreground so it reads as part of the dark column rather than as a
          sticker on it, and it is inset by a row's own padding so its mark
          lines up with the glyph column underneath. */}
      <div className="border-sidebar-border/50 flex shrink-0 items-center border-b px-2.5 pt-1 pb-3">
        <MesitaLogo variant="horizontal" className="text-sidebar-foreground h-5 w-auto" />
      </div>

      <nav
        aria-label="Console"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pt-2"
      >
        {scope.mode === "unknown" && (
          <>
            <MutedRow label="Places unavailable" Icon={Store} />
            <button
              type="button"
              onClick={onRetry}
              className={cn(ROW_BASE, ROW_REST, "w-full")}
            >
              <RotateCw className={ICON} />
              <span className="truncate">Try again</span>
            </button>
          </>
        )}

        {scope.mode === "zero" && (
          <NavRow
            href={SHELL_ROUTES.placesNew}
            label="Add your place"
            Icon={Plus}
            active={onAddPlace}
            onNavigate={onNavigate}
          />
        )}

        {showRows && place && (
          <VenueRow
            placeId={place.id}
            name={place.name}
            photoUrl={place.photoUrl}
            onHome={isPlaceHomePathname(pathname)}
            onNavigate={onNavigate}
          />
        )}

        {showRows &&
          RAIL_ROWS.map((row) => {
            // NO WRAPPER. Every row used to be wrapped so a seam or a section
            // head could hang off it; both are gone, so a row is a row.
            if (row.kind === "page") {
              if (!allowed.pages.has(row.target)) return null;
              return (
                <NavRow
                  key={`page:${row.target}`}
                  href={placePageHref(placeId ?? "", row.target)}
                  label={PLACE_PAGE_LABEL[row.target]}
                  Icon={PAGE_ICON[row.target]}
                  active={currentPage === row.target}
                  onNavigate={onNavigate}
                />
              );
            }
            if (!allowed.views.has(row.view)) return null;
            return (
              <NavRow
                key={`place:${row.view}`}
                href={placeTabHref(placeId ?? "", row.view)}
                label={PLACE_TAB_LABEL[row.view]}
                Icon={VIEW_ICON[row.view]}
                active={currentView === row.view}
                onNavigate={onNavigate}
              />
            );
          })}
      </nav>

      {/* THE FOOT: THE PERSON, pinned, alone (MESITA-1905, MESITA-1937).

          IT IS ACCOUNT AND NOT SETTINGS, and the difference is scope, not
          subject. Settings is a row in the scroller because it configures the
          PLACE the whole scroller is about; this band is YOU, across every
          place you hold, which is why it sits below the seam where the scope
          changes.

          IT RENDERS IN EVERY STATE, including the failed read: whatever went
          wrong with the places, the person is still signed in — and Sign out
          lives on that page and nowhere else, so a rail without this band is a
          console with no exit. That is the one constraint the shape of this
          rail is not allowed to lose, and it is why the exit sits on ACCOUNT
          rather than on Settings, which draws nothing at all in two of the four
          shapes. */}
      <div className={cn(SECTION_SEAM, "shrink-0")}>
        <NavRow
          href={SHELL_ROUTES.account}
          label="Account"
          title={`Account · ${viewerLabel}`}
          Icon={UserRound}
          active={onAccount}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}

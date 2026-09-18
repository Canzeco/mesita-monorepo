"use client";

// THE RAIL. One dark column, a head, a venue, TWO rows, a foot — and FOUR
// destinations, which is the number that matters.
//
// ── THE SHAPE (MESITA-1973) ───────────────────────────────────────────────
//
//   ┌──────────────────┐
//   │  mesita.         │  the HEAD: the lockup, pinned, scrolls with nothing
//   ├──────────────────┤
//   │  ▣ Lumbre y Sal ⌄│  PLACE: the subject, and Home's door
//   │  ▦ Setup         │  ┐ THE TWO. Everything the place RUNS, and
//   │  ▥ Activity      │  ┘ everything that HAPPENED.
//   │                  │  the slack falls HERE
//   ├──────────────────┤
//   │  ⚙ Settings      │  the FOOT: you, what you owe, this place's config
//   └──────────────────┘
//
// Pato, 2026-09-18: *"Place, Setup, Activity, Settings"* — *"FOUR SCREENS
// EASY."*
//
// ── WHY FOUR, AND WHY TWO OF THEM ARE BANDS ────────────────────────────────
//
// A RAIL DOES NOT PORT TO A PHONE. Nine rows were never going to become
// mobile-business's IA, and consumer web and mobile already live by the rule
// that the two never diverge. Four destinations are a tab bar under a finger
// and this column under a cursor, unchanged.
//
// PLACE IS THE VENUE BAND because the band already names the subject and links
// its bare address (MESITA-1933). A row reading "Place" beneath a band reading
// which place is the same door drawn twice.
//
// SETTINGS IS THE FOOT because `showRows` draws `RAIL_ROWS` only in the `solo`
// and `multi` shapes. Sign out lives on Settings now, so a Settings ROW would
// strand the console's only exit behind a failed places read — the exact
// defect MESITA-1937 named when it put the exit on Account. The band renders
// in all four shapes and its address needs no place, which is the other half
// of the same guarantee and the half MESITA-1935 missed.
//
// THE MERGE ITSELF REVERSES MESITA-1937. That issue kept the person and the
// place apart on the argument that scope is the divider. Pato asked for
// *"Settings, Account also here"*: one screen holding you, Billing and this
// place's config is four destinations instead of five, and the scope split
// survives INSIDE the page as its three sections.
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
import { Fragment, useMemo } from "react";
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
} from "@/lib/console-routes";
import { pagesForAccess } from "@/lib/place-tabs";
import type { RailScope } from "@/lib/rail-scope";
import { cn } from "@/lib/utils";

// ONE SIZE, AND IT IS THE BIG ONE (MESITA-1956). Pato: *"sidebar menu items
// more bigger"*, then *"make sidebar menu font bigger"*. The rail used to
// SHRINK on desktop — 14px glyph and 13px label under a cursor, 16px and 14px
// under a finger — which is backwards twice over: the desktop rail is the
// column you scan all day, and it had the smallest type in the app sitting on
// the darkest ground, where contrast sensitivity is already worst.
//
// THE GLYPH STOPS AT 20px while the label sits at `text-sm`: all three asks
// named the FONT, and a mark that scales with it gives back the scannability
// the icons are carrying on a dark column. It is deliberately larger than
// its label — the old rail had a 14px glyph beside a 13px word, which is a
// mark you have to look for.
const ICON = "h-5 w-5 shrink-0";

// `text-sm`, AFTER 17 AND 15 (MESITA-1958). Three size calls in a row —
// *"more bigger"*, *"font bigger"*, then *"a bit smaller"* twice — and this
// is where it stops, because 14px is not another arbitrary step: it is the
// app's base body size AND the size this rail already used on a phone before
// MESITA-1956 touched it. The `text-[Npx]` arbitrary value is gone with it,
// so nobody has to guess where the number came from.
//
// A rail row is a LABEL, not body copy: at 17px on a 223px column six words
// stopped reading as a list of destinations and started reading as content,
// which is the same failure as 13px from the other side.
//
// THE `lg:` DOWNSHIFTS STAY DELETED, and that is the part that matters. The
// defect MESITA-1956 fixed was the rail being a DIFFERENT size on desktop
// than on a phone — `lg:text-[13px]` under a cursor, `text-sm` under a
// finger, the smallest type in the app on the darkest ground. One size at
// every width is the RULE; every pass since has only moved where that one
// size sits, and it has landed back on the mobile value. Net against the old
// rail: desktop 13px → 14px, mobile unchanged, the two finally agree.
//
// `min-h-11` still holds the 44px touch target on a phone; desktop reaches
// the same row height through `lg:py-2.5` instead.
const ROW_BASE =
  "flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition min-h-11 lg:min-h-0 lg:py-2.5 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";
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
  "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-sm font-semibold tracking-tight transition min-h-11 lg:min-h-0 lg:py-2 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring";
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
const PAGE_ICON: Record<
  PlacePage,
  React.ComponentType<{ className?: string }>
> = {
  setup: LayoutGrid,
  activity: ChartNoAxesColumn,
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

  const currentPage: PlacePage | null =
    placePageFromPathname(pathname) ?? flatPlacePageFromPathname(pathname);

  const onSettings = pathname === SHELL_ROUTES.settings;
  const onAddPlace = pathname === SHELL_ROUTES.placesNew;

  // WHICH ROWS THIS CALLER MAY SEE. ONE matrix now, because every row is a
  // page: `tabsForAccess` filtered the product rows and there are none
  // (MESITA-1973). It has not stopped mattering — SETUP applies it per product
  // row, and `PlaceTabGate` still 404s every view address — but the rail is no
  // longer the thing riding it, which is the failure MESITA-1933 named.
  //
  // A VIEWER GETS NO ROWS AT ALL, and that is the honest picture: Setup and
  // Activity are both all-or-nothing in `pagesForAccess`, so a viewer sees the
  // venue band, the venue's Home screen, and Settings.
  const allowed = useMemo(() => {
    const access = {
      held: place !== null,
      role: place?.myRole ?? null,
      isSuperAdmin,
    };
    return { pages: new Set<PlacePage>(pagesForAccess(access)) };
  }, [place, isSuperAdmin]);

  // THE FOUR SHAPES. `unknown` is NOT `zero` with a sad face: it offers a
  // retry and never the word "add", because a failed read has not established
  // that the caller holds nothing.
  const showRows =
    (scope.mode === "solo" || scope.mode === "multi") && placeId !== null;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-3 pb-3">
      {/* THE HEAD. The lockup is a LABEL, not a link: every address this rail
          reaches is below it, and a logo that navigates somewhere would be
          one more destination wearing different clothes. It takes the rail's own
          foreground so it reads as part of the dark column rather than as a
          sticker on it, and it is inset by a row's own padding so its mark
          lines up with the glyph column underneath. */}
      <div className="border-sidebar-border/50 flex shrink-0 items-center border-b px-2.5 pt-1 pb-3">
        <MesitaLogo
          variant="horizontal"
          className="text-sidebar-foreground h-5 w-auto"
        />
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
            // STILL NO WRAPPER. A seam is a SIBLING hairline emitted before
            // its row, not a box around a group: wrapping would put a div
            // between the nav's flex column and its rows, and every `gap-0.5`
            // between them with it. The fragment costs nothing and the rows
            // stay rows.
            const seam = row.seam ? (
              <div
                aria-hidden
                className="border-sidebar-border/50 mx-3 my-2 border-t"
              />
            ) : null;
            if (!allowed.pages.has(row.target)) return null;
            return (
              <Fragment key={`page:${row.target}`}>
                {seam}
                <NavRow
                  href={placePageHref(placeId ?? "", row.target)}
                  label={PLACE_PAGE_LABEL[row.target]}
                  Icon={PAGE_ICON[row.target]}
                  active={currentPage === row.target}
                  onNavigate={onNavigate}
                />
              </Fragment>
            );
          })}
      </nav>

      {/* THE FOOT: THE FOURTH TAB, pinned (MESITA-1905, MESITA-1973).

          IT IS SETTINGS AND IT IS ALSO THE PERSON. MESITA-1937 split these on
          the argument that scope is the divider — Settings configures the
          place, Account is you — and four tabs overrule it: Pato asked for
          *"Settings, Account also here"* in one breath, and one screen holding
          you, what you owe and this place's config is four destinations
          instead of five.

          IT STAYS A BAND RATHER THAN A ROW, and that is the part of
          MESITA-1937 that survives intact. `showRows` draws `RAIL_ROWS` only
          in the `solo` and `multi` shapes, so a Settings ROW would take the
          console's only exit down with a failed places read. The address is
          not place-scoped for the same reason: `/settings` resolves with no
          place at all, which is what MESITA-1935 got wrong when it last tried
          this merge. */}
      <div className={cn(SECTION_SEAM, "shrink-0")}>
        <NavRow
          href={SHELL_ROUTES.settings}
          label="Settings"
          title={`Settings · ${viewerLabel}`}
          Icon={Settings}
          active={onSettings}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}

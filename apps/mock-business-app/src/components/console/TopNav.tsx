"use client";

// THE MENU. One line across the top, a lockup and FOUR TABS — and four is the
// number that matters.
//
// ── THE SHAPE (MESITA-1975 · 1976) ─────────────────────────────────────────
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │  mesita.   Place   Setup   Activity   Settings                   │
//   └──────────────────────────────────────────────────────────────────┘
//                 ▔▔▔▔▔  the active tab, ink text over a 2px ink rule
//
// Pato, 2026-09-18: *"Logo, place, setup, activity, settings"* — *"put the
// place in its own page, not a fucking weird selector toggle."*
//
// ── WHAT LEFT WITH THE RAIL ────────────────────────────────────────────────
//
// THE VENUE BAND. The rail's first item wore the place's photo and name
// because a 272px column had room for them. A line does not: "Lumbre y Sal"
// plus three labels is 355px of a 375px phone, and a 24-character venue name
// breaks the row outright. The name lives on the place's own screen now, and
// on Setup and Activity through `PlaceHeading`.
//
// THE CARET, and with it the last dropdown in the app. PLACE IS THE SWITCHER
// ITSELF (MESITA-1976): the tab points at `/places`, the portfolio — your
// places, the pool, the Add door — and picking one lands you on it. Pato:
// *"place is not a home. place is just to select the place… you have like a
// portfolio of places and you can switch across them."* MESITA-1918 deleted
// the selector MENU because it carried the open address across a switch; a
// list you pick from lands you at the top of the one you picked, which is what
// a list has always done.
//
// THE DRAWER AND THE HAMBURGER (see `AppShell.tsx`). Four destinations are the
// same IA under a finger and under a cursor, which is the entire reason there
// are four. A menu that becomes a hamburger below `lg` is two IAs.
//
// THE ACCOUNT AVATAR NEVER ARRIVED. Settings IS the person — you, what you owe,
// and this place's config, one screen since MESITA-1973 — so a second control
// for them would be the same door wearing a photograph.
//
// ── THE LAWS IT KEEPS ──────────────────────────────────────────────────────
//
// ONE MENU, FROM ONE ARRAY. Every tab comes from `NAV_ROWS`; there is no second
// list. Moving a tab is an edit to one line in lib/console-routes.ts — and now
// that the bands are rows, that is true of all four rather than of two.
//
// TABS NEVER DIM. A destination a caller cannot reach is NOT RENDERED. A menu
// where some entries are real and some are decoration is a menu you stop
// reading, and `pagesForAccess` is the only thing that decides.
//
// THE BAR IS INK (MESITA-1981). Pato: *"top menu must be different color.
// black. then bottom must be white or whatever."* MESITA-1975 shipped it light
// on the argument that `--dock` also paints the AskBar band and Home may hold
// only one dark object. That argument is overruled and the cost is real and
// visible: on Home there are now two ink surfaces, the menu at the top and the
// band below it. The band keeps its radius and its inset, so what separates
// them is shape rather than value.
//
// IT PAINTS WITH `--dock-*`, WHICH IS THE VOCABULARY THAT EXISTS FOR THIS.
// `--dock` is `--ink`, not pure black: `--dock-surface` is white at 10%, which
// composites to #1a1a1a over #000 (a 1.20:1 step nobody sees) and to #2e2e2e
// over the ink (1.73:1, which you do). Pure black is reserved — `--mock-strip`
// is the one thing in the app that may take it, because the strip sits
// directly above this bar and two identical black slabs read as chrome rather
// than as a warning.
//
// NOTHING HERE MAY READ A PAGE TOKEN. `text-muted-foreground` is #5d5d5d and
// `bg-foreground` is the ink itself: on this ground the first is unreadable and
// the second is invisible. Rest is `--dock-muted` (white at 64%, 7.84:1 on the
// ink), hover is full white, and the ring is `--sidebar-ring`, which is pure
// white and exists for exactly this reason — the page's `--ring` is ink, and an
// ink ring on an ink bar is no ring at all.
//
// THE ACTIVE TAB IS STILL A RULE, NOT A PILL. The rail's solid off-white pill
// was the brightest object in a 272px column and it worked there; across a
// 1400px line the same fill is a slab with a word in it. Weight plus a 2px
// white underline says "you are here" without painting a block.
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import {
  NAV_HOME_LABEL,
  NAV_ROWS,
  NAV_SETTINGS_LABEL,
  PLACE_PAGE_LABEL,
  SHELL_ROUTES,
  flatPlacePageFromPathname,
  isPlaceHomePathname,
  placeIdFromPathname,
  placePageFromPathname,
  placePageHref,
} from "@/lib/console-routes";
import { pagesForAccess } from "@/lib/place-tabs";
import type { RailScope } from "@/lib/rail-scope";
import { cn } from "@/lib/utils";

// ONE SIZE AT EVERY WIDTH, and it is the app's base body size. The rail landed
// on `text-sm` after five passes (MESITA-1956 → 1958) for a reason that
// survives the move: a nav label is a LABEL, not body copy, and the same size
// under a finger and a cursor is the rule the rail broke and then fixed.
//
// `min-h-11` holds the 44px touch target. The tab is the whole height of the
// bar so the underline sits on the bar's own hairline rather than floating
// above it.
const TAB_BASE =
  "relative flex min-h-11 items-center px-3 text-sm font-medium transition outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset sm:px-3.5";
const TAB_REST = "text-dock-muted hover:text-dock-foreground";
const TAB_ACTIVE = "text-dock-foreground font-semibold";
// The rule is drawn on the tab, 2px of `--ink`, flush with the bar's hairline.
// `-bottom-px` puts it OVER that hairline rather than above it — a 1px gap
// between the two reads as a misalignment nobody can name.
const TAB_RULE =
  "after:bg-dock-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:content-['']";

function Tab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(TAB_BASE, active ? cn(TAB_ACTIVE, TAB_RULE) : TAB_REST)}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Where the Place tab points, and what it is called.
 *
 *  `/places`, AT EVERY MODE — IT IS THE SWITCHER (MESITA-1976). Pato: *"place
 *  is not a home. place is just to select the place… you have like a portfolio
 *  of places and you can switch across them."* MESITA-1975 pointed it at
 *  `/places/<id>` on the argument that the venue is the console's subject;
 *  the subject is not the tab. The portfolio is.
 *
 *  ONE ADDRESS AT ALL FOUR SHAPES, which is the other thing this buys. The
 *  catalogue already tells a failed read apart from an empty one and already
 *  carries the Add door, so `unknown` and `zero` stop needing a tab that
 *  changes its own name — and a menu whose labels move between reads is a menu
 *  you have to re-scan. */
function placeTab(): { href: string; label: string } {
  return { href: SHELL_ROUTES.places, label: NAV_HOME_LABEL };
}

export function TopNav({
  scope,
  isSuperAdmin,
}: {
  scope: RailScope;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const place = scope.place;
  const placeId = place?.id ?? null;

  const currentPage =
    placePageFromPathname(pathname) ?? flatPlacePageFromPathname(pathname);

  // WHICH PAGES THIS CALLER MAY SEE. Unchanged from the rail: `pagesForAccess`
  // is the only filter, and a viewer gets neither Setup nor Activity — both are
  // all-or-nothing — so their menu is Place and Settings. Hiding is not the
  // gate: `PlaceTabGate` and each page's own `notFound` still refuse the
  // address.
  const allowedPages = new Set(
    pagesForAccess({
      held: place !== null,
      role: place?.myRole ?? null,
      isSuperAdmin,
    }),
  );

  // THE PLACE-SCOPED TABS NEED A PLACE TO POINT AT. At `unknown` and `zero`
  // there is none, so Setup and Activity are absent rather than dead — the same
  // call the rail made with `showRows`, for the same reason.
  const showPages =
    (scope.mode === "solo" || scope.mode === "multi") && placeId !== null;

  const home = placeTab();
  // THE TAB IS LIT ON THE SWITCH AND ON WHAT THE SWITCH LANDS YOU ON.
  // `/places` is the tab itself and `/places/new` is its Add door; `/places/<id>`
  // is where picking a place from the portfolio drops you, and the tab you
  // just came from must not go dark underneath you (MESITA-1976). That screen
  // keeps its address and loses only its door.
  const onPlaces =
    pathname === SHELL_ROUTES.places ||
    pathname === SHELL_ROUTES.placesNew ||
    isPlaceHomePathname(pathname);
  // A PRODUCT VIEW IS A DRILL-DOWN OF SETUP. `/places/<id>/visits` has no tab
  // of its own — it is reached from a Setup card — so Setup stays lit
  // underneath it. The alternative is a menu with nothing lit on nine of the
  // console's screens, which teaches an operator that the menu stops answering
  // "where am I" as soon as they go anywhere.
  const onView =
    placeIdFromPathname(pathname) !== null &&
    !isPlaceHomePathname(pathname) &&
    currentPage === null;

  return (
    <div className="bg-dock flex h-14 shrink-0 items-center gap-1 px-3 sm:gap-2 sm:px-4">
      {/* THE LOCKUP IS A LABEL, NOT A LINK. Every address this bar reaches is
          on the same line as it, so a logo that navigated would be a fifth
          destination in different clothes — and the rail made the same call
          for the same reason.

          IT GIVES UP ITS WIDTH FIRST. The four tabs are what has to fit a
          375px phone; the lockup is the only thing on the line that is not a
          destination, so it is the thing that shrinks — h-3.5 under a finger,
          h-4 from `sm` up. There is no mark-only variant to fall back to
          (`MesitaLogo` draws horizontal or stacked), and dropping it outright
          below `sm` would leave a phone with no lockup at all, which is one of
          the five things Pato named. */}
      {/* THE LOCKUP TAKES THE BAR'S OWN FOREGROUND so it reads as part of the
          ink rather than as a sticker on it — the same call the rail made. */}
      <MesitaLogo
        variant="horizontal"
        className="text-dock-foreground h-3.5 w-auto shrink-0 pr-1 sm:h-4 sm:pr-2"
      />

      <nav
        aria-label="Console"
        className="flex min-w-0 flex-1 items-stretch gap-0.5 sm:gap-1"
      >
        {NAV_ROWS.map((row) => {
          if (row.kind === "home") {
            return (
              <Tab
                key="home"
                href={home.href}
                label={home.label}
                active={onPlaces}
              />
            );
          }
          if (row.kind === "settings") {
            return (
              <Tab
                key="settings"
                href={SHELL_ROUTES.settings}
                label={NAV_SETTINGS_LABEL}
                active={pathname === SHELL_ROUTES.settings}
              />
            );
          }
          if (!showPages || !allowedPages.has(row.target)) return null;
          return (
            <Tab
              key={`page:${row.target}`}
              href={placePageHref(placeId ?? "", row.target)}
              label={PLACE_PAGE_LABEL[row.target]}
              active={
                currentPage === row.target || (onView && row.target === "setup")
              }
            />
          );
        })}
      </nav>
    </div>
  );
}

"use client";

// THE FRAME: strip, then a menu COLUMN beside one scroller (MESITA-2004).
//
//   ┌──────────────────────────────────────────────────┐
//   │ MOCK  Nothing here is real…                      │  the strip, full width
//   ├────────────┬─────────────────────────────────────┤
//   │  mesita.   │                                     │
//   │  Lumbre…   │   main — THE ONLY PAGE SCROLLER     │
//   │  📍 Place  │                                     │
//   │  …         │                                     │
//   └────────────┴─────────────────────────────────────┘
//
// Above `lg` the column is always there. Below it, the column is a DRAWER and
// the page gets a bar with a hamburger — see below for why that reverses a law
// MESITA-1975 wrote, and why the law was right for four rows and wrong for
// fourteen.
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/console/Sidebar";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MockPanel } from "@/components/console/MockPanel";
import { useMock } from "@/mock/MockStore";
import { resolveRailScope } from "@/lib/rail-scope";
import { SHELL_ROUTES, placeIdFromPathname } from "@/lib/console-routes";
import { PLACE_TABS, PLACE_TAB_LABEL, type PlaceTab } from "@/lib/place-tabs";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

function placeScreenTitle(pathname: string, name: string): string | null {
  if (!placeIdFromPathname(pathname)) return null;
  if (pathname === SHELL_ROUTES.settings) return "Settings";
  const seg = pathname.split("/")[3];
  // `/activity` AND `/activity/<slug>` both land here. The whole-place log
  // lost its menu row in MESITA-2005 but kept its address, and a screen with
  // no row still owes a title to a screen reader.
  if (seg === "activity") return `${name} · Activity`;
  if (seg && (PLACE_TABS as readonly string[]).includes(seg)) {
    return `${name} · ${PLACE_TAB_LABEL[seg as PlaceTab]}`;
  }
  return name;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { world, scenario, lastPlaceId, rememberPlace } = useMock();

  const scope = resolveRailScope({
    places: world.places,
    pathname,
    lastPlaceId,
    viewerError: world.viewerError,
  });

  // THE WHOLE RECORD FOR THE MENU. `scope.place` is a `RailPlace`, a six-field
  // `Pick`, and the menu now renders a product row per product — which means it
  // runs `buildProductCards`, which interrogates the place far past those six
  // fields. The scope still decides WHICH place; this is only the lookup that
  // turns its id back into the record it came from.
  const fullPlace = scope.place
    ? (world.places.find((p) => p.id === scope.place?.id) ?? null)
    : null;

  const subject =
    scope.place ??
    (scope.foreignPlaceId
      ? (world.poolPlaces.find((p) => p.id === scope.foreignPlaceId) ?? null)
      : null);
  const title = subject ? placeScreenTitle(pathname, subject.name) : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // THE DRAWER CLOSES ON ARRIVAL. Without this, tapping a row leaves the panel
  // sitting over the screen it just opened and the operator has to dismiss the
  // menu to see what they asked for. `Sidebar` fires `onNavigate` too, but that
  // only covers a click on a row — this covers every other route change,
  // including the browser's own back button.
  //
  // IT ADJUSTS DURING RENDER, NOT IN AN EFFECT. `useEffect(() =>
  // setDrawerOpen(false), [pathname])` is the obvious spelling and it is a LINT
  // ERROR in Next 16 (`react-hooks/set-state-in-effect`) — a synchronous
  // setState in an effect body is a cascading render, and the drawer would
  // paint once over the new screen before closing. This is React's own
  // adjusting-state-on-prop-change pattern: the comparison runs during render,
  // React re-runs the component immediately with the new state, and nothing
  // ever reaches the screen with the drawer open over a page it did not open.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setDrawerOpen(false);
  }

  // ESCAPE CLOSES IT, and the page under it does not scroll while it is open.
  // A drawer you can scroll behind is a drawer that loses its place.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (scope.place && scope.placeIsCurrent) rememberPlace(scope.place.id);
  }, [scope.place, scope.placeIsCurrent, rememberPlace]);

  return (
    <div className="bg-background fixed inset-0 flex flex-col">
      {/* THE STRIP. Above everything, full width, outside both scrollers: it
          must be unmissable and it must not change what is below it, because
          the whole point of this app is that what you see below is what the
          console looks like.

          IT NAMES NO ADDRESS (MESITA-1904). It used to end "invented data on
          :3006", which was true while the app only ever ran locally and became
          false the day it was deployed. A strip whose entire job is to be
          believed cannot carry a claim the reader can check and find wrong. */}
      <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-[color:var(--mock-strip)] px-3 text-[11px] font-semibold tracking-wide text-white">
        <span className="rounded-sm bg-white/25 px-1.5">MOCK</span>
        <span className="truncate">
          Nothing here is real. No backend, no account, no place — every name
          and number on this screen is invented.
        </span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* THE COLUMN, ABOVE `lg` ONLY — 252px, fixed, its own scroller.

            252px IS THE LONGEST NAME PLUS ITS BADGE, not a fraction of the
            window. MESITA-2001 learned this the expensive way: `grid-cols-3`
            drew a 660px index on a 1980px monitor, holding 34px rows whose name
            was flush left and whose state was flush right, ~450px apart, twelve
            times. A navigator does not get wider because there is room. It gets
            as wide as "Online Reservations" and a badge, and the page keeps the
            rest.

            `shrink-0` MATTERS. Without it the column gives up width to a wide
            table before the table ever scrolls, and the menu narrows as a
            consequence of something happening on the other side of the screen. */}
        <div className="hidden w-[252px] shrink-0 lg:block">
          <Sidebar
            scope={scope}
            place={fullPlace}
            isSuperAdmin={scenario.isSuperAdmin}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* THE PHONE BAR, BELOW `lg` ONLY. It carries the hamburger and the
              lockup, and nothing else — the venue is in the drawer, on the band.

              THIS REVERSES MESITA-1975, ON PURPOSE. That issue deleted the
              drawer and the hamburger and wrote down why: *"Four destinations
              are the same IA under a finger and under a cursor, which is the
              entire reason there are four."* That was true of four. It is not
              true of fourteen: fourteen rows is 504px of column before the
              lockup and the venue band, on a screen that is 812px tall with
              ~90px already spent on chrome. The alternative — the menu as a
              SCREEN you go back to — makes the phone and the desktop two
              different IAs, which is the thing MESITA-1975 refused. A drawer
              keeps one IA and hides it; a separate screen keeps it visible and
              forks it. */}
          <div className="bg-dock flex h-13 shrink-0 items-center gap-3 px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              className="text-dock-foreground focus-visible:ring-sidebar-ring -ml-1 flex h-11 w-11 items-center justify-center rounded-lg outline-hidden focus-visible:ring-2"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <MesitaLogo
              variant="horizontal"
              className="text-dock-foreground h-4 w-auto shrink-0"
            />
          </div>

          {/* THE ONLY PAGE SCROLLER. */}
          <main className="min-h-0 flex-1 overflow-y-auto">
            {title && <h1 className="sr-only">{title}</h1>}
            {/* FLUID: no max-width. A full-bleed child cancels SHELL_GUTTER
                with SHELL_BLEED and only reaches the column edge if nothing
                caps it. Readability is protected per-element
                (FORM_COLUMN_CLASS), not by squeezing the console. */}
            <div
              className={cn(
                // `min-h-full` SO A SHORT PANE STILL REACHES THE BOTTOM. The
                // old two-column shell pinned itself to
                // `lg:h-[calc(100vh-7rem)]`, so its white surface always filled
                // the window; without that, Prepaid Credits' Setup half — two
                // tiles and nothing else — painted ~120px of white and then
                // left the page's grey below it, which reads as a card that
                // ran out rather than as a screen. Border-box means the
                // padding is inside this height, and `ProductShell` cancels
                // both ends of it before adding its own.
                "flex w-full min-h-full flex-col gap-4 py-4 sm:py-8",
                SHELL_GUTTER,
              )}
            >
              {/* SUSPENSE, because pages below read `searchParams` — the
                  catalogue's `?owned=` and Stripe's stored `?connect=`. Reading
                  them opts a page out of prerendering, and without a boundary
                  the whole route is refused at build time.

                  The boundary is HERE rather than around the shell: the menu
                  reads no query and has no reason to wait, and a frame that
                  blanks the navigation while a table loads is the flicker this
                  console spent an issue removing. The fallback is a quiet line,
                  not a skeleton — a shape that guesses wrong is worse than a
                  word that does not. */}
              <Suspense
                fallback={
                  <p className="text-muted-foreground text-sm" role="status">
                    Loading…
                  </p>
                }
              >
                {children}
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {/* THE DRAWER. Rendered only while open, so nothing below `lg` pays for a
          menu it is not looking at — and, more to the point, so the fifteen rows
          are not in the accessibility tree twice at every width. `AppShell`
          renders the menu in two places and that is the trap MESITA-1968 wrote
          down in `web-business`: an edit lands on one copy and every gate stays
          green. Both copies are the SAME `<Sidebar>` with the same props, which
          is the only version of this that is safe. */}
      {drawerOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-7 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Console menu"
        >
          {/* `top-7`, NOT `inset-0`. The drawer must not cover the MOCK strip.
              The strip is the only thing standing between this app and a
              stranger who found it — it is publicly reachable, every name and
              number on it is invented, and the package's own rules call the
              strip load-bearing rather than garnish. A menu that paints over it
              makes a screen where nothing says MOCK, on the one surface where
              somebody unfamiliar is most likely to be poking around. 28px is
              the strip's height and this tracks it. */}
          <div className="w-[252px] shrink-0">
            <Sidebar
              scope={scope}
              place={fullPlace}
              isSuperAdmin={scenario.isSuperAdmin}
              onNavigate={closeDrawer}
            />
          </div>
          {/* THE SCRIM IS A BUTTON, not a div with an onClick. Tapping outside
              to dismiss is the gesture everyone already has; making it a real
              control is what gives it a keyboard and a name. */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="flex-1 bg-black/45"
          />
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="absolute top-1 right-3 flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

      <MockPanel />
    </div>
  );
}

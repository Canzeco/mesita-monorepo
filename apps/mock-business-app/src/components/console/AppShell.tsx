"use client";

// THE FRAME. `fixed inset-0`, the menu above main, and `main` IS THE ONLY
// SCROLLER.
//
// That last clause is the one to keep. A full-height card inside main is
// `absolute inset-0` over a definite parent; if the chain from here down loses
// its definite height, `h-full` resolves to nothing and the card renders as an
// empty box — with every check still green, because nothing threw. So the
// heights here are explicit at every level rather than inherited by luck.
//
// THERE IS A TOP NAV NOW, AND THERE IS NO RAIL (MESITA-1975). Four
// destinations on one line, from `NAV_ROWS`; see `TopNav.tsx` for why the
// venue band, the caret, the drawer and the hamburger all went with it. The
// old note here said there was no top nav *because* the rail carried the
// place's name beside its views — that premise is what this issue removed.
//
// AND SINCE MESITA-1943, NOTHING INSIDE MAIN RESTATES THEM EITHER. `PlaceHeading`
// was that row with the sticky taken off — photo, name and view label, on the
// page, at the top of all seven place screens. Pato: *"remove this stupid header
// or put it in a dark box"*. Painting it dark would have made the duplication
// LOUDER and cost three things: the Verified pill is `bg-foreground`, which is
// this file's `--dock` exactly (1.00:1 on its own ground); gold fell 7.8:1 →
// 1.4:1; and on Home the box landed 16px above `AskBar`, which exists to be the
// only dark object there. The one screen that could not lose its label for free
// is `products/pay` — no rail row points at it — and it kept a back door instead
// of a heading.
import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "@/components/console/TopNav";
import { MockPanel } from "@/components/console/MockPanel";
import { useMock } from "@/mock/MockStore";
import { resolveRailScope } from "@/lib/rail-scope";
import {
  PLACE_PAGE_LABEL,
  SHELL_ROUTES,
  placeIdFromPathname,
  placePageFromPathname,
} from "@/lib/console-routes";
import { PLACE_TABS, PLACE_TAB_LABEL, type PlaceTab } from "@/lib/place-tabs";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** THE PLACE SCREEN'S `h1`, AND IT IS SCREEN-READER-ONLY (MESITA-1943).
 *
 *  Deleting `PlaceHeading` took the visible title off seven screens, which was
 *  the point — the rail says the name, the photo and the view. What the rail
 *  cannot be is a HEADING. `Section` renders `h3`, so with the title gone these
 *  pages opened on an h3 with h1 AND h2 skipped: axe flags it, and VoiceOver's
 *  rotor has nothing to land on. `apps/web-business`'s own `PlaceHeading`
 *  carries that exact note as the reason it survived its own PlaceBar.
 *
 *  So the outline keeps its root and the page keeps its pixels. It names the
 *  VIEW as well as the place, because seven screens announcing one title is a
 *  rotor that cannot tell you that you moved.
 *
 *  It is skipped where a screen already draws its own `h1` — `/places`,
 *  `/places/new`, `/account` — which is exactly where `placeIdFromPathname`
 *  returns null. The flat names (`/profile`, `/orders`) never reach here: they
 *  307 onto the canonical address. */
function placeScreenTitle(pathname: string, name: string): string | null {
  if (!placeIdFromPathname(pathname)) return null;
  // SETUP AND ACTIVITY DRAW A REAL ONE (MESITA-1975). `PlaceHeading` is back on
  // exactly those two, so an sr-only title here would be a SECOND `h1` on the
  // same document saying the same words — which is worse for a rotor than the
  // missing root this function exists to supply.
  if (placePageFromPathname(pathname)) return null;
  // Pay first: it lives UNDER `products`, so the page reader below would
  // answer "Products" for it and lose the sub-step the back link names.
  if (pathname === SHELL_ROUTES.settings) return "Settings";
  const page = placePageFromPathname(pathname);
  if (page) return `${name} · ${PLACE_PAGE_LABEL[page]}`;
  const seg = pathname.split("/")[3];
  if (seg && (PLACE_TABS as readonly string[]).includes(seg)) {
    return `${name} · ${PLACE_TAB_LABEL[seg as PlaceTab]}`;
  }
  // The bare address, which is Home.
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

  // A POOL PLACE GETS ONE TOO. `scope.place` is null when the caller holds no
  // membership on the place the address names, but `[view]` still renders
  // Profile's "Nobody holds this place" for it — a screen with the same h3-only
  // outline as any other.
  const subject =
    scope.place ??
    (scope.foreignPlaceId
      ? (world.poolPlaces.find((p) => p.id === scope.foreignPlaceId) ?? null)
      : null);
  const title = subject ? placeScreenTitle(pathname, subject.name) : null;

  // The menu learns the open place from the ADDRESS, and remembers it for the
  // flat names that carry none.
  useEffect(() => {
    if (scope.place && scope.placeIsCurrent) rememberPlace(scope.place.id);
  }, [scope.place, scope.placeIsCurrent, rememberPlace]);

  return (
    <div className="bg-background fixed inset-0 flex flex-col">
      {/* THE STRIP. Above the menu, not inside main: it must be unmissable and
          it must not change main's own layout, because the whole point of this
          app is that what you see below is what the console looks like.

          IT NAMES NO ADDRESS (MESITA-1904). It used to end "invented data on
          :3006", which was true while the app only ever ran locally and became
          false the day it was deployed — on the hosted copy it named a port the
          reader was not on. A strip whose entire job is to be believed cannot
          carry a claim the reader can check and find wrong: one false detail
          costs it the sentence that matters, and the sentence that matters is
          "none of this is real". So it states only what is true in both
          places. */}
      <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-[color:var(--mock-strip)] px-3 text-[11px] font-semibold tracking-wide text-white">
        <span className="rounded-sm bg-white/25 px-1.5">MOCK</span>
        <span className="truncate">
          Nothing here is real. No backend, no account, no place — every name
          and number on this screen is invented.
        </span>
      </div>

      {/* THE MENU, between the strip and main. It is OUTSIDE the scroller for
          the same reason the strip is: main scrolling under a fixed line is
          what makes the line read as chrome rather than as content that
          happened to be first. */}
      <TopNav scope={scope} isSuperAdmin={scenario.isSuperAdmin} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* THE ONLY SCROLLER. */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {title && <h1 className="sr-only">{title}</h1>}
          {/* FLUID: no max-width. A full-bleed child cancels SHELL_GUTTER
                with SHELL_BLEED and only reaches the column edge if nothing
                caps it. Readability is protected per-element
                (FORM_COLUMN_CLASS), not by squeezing the console. */}
          <div
            className={cn(
              "flex w-full flex-col gap-4 py-4 sm:py-8",
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

      <MockPanel />
    </div>
  );
}

"use client";

// THE FRAME. `fixed inset-0`, rail beside main, and `main` IS THE ONLY
// SCROLLER.
//
// That last clause is the one to keep. A full-height card inside main is
// `absolute inset-0` over a definite parent; if the chain from here down loses
// its definite height, `h-full` resolves to nothing and the card renders as an
// empty box — with every check still green, because nothing threw. So the
// heights here are explicit at every level rather than inherited by luck.
//
// There is no sticky place bar and no top nav above main. The rail carries the
// place's name AND its views, so a row restating both would be chrome saying
// what the column beside it already says.
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
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/console/Sidebar";
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
  const { world, scenario, setScenario, lastPlaceId, rememberPlace, viewer } = useMock();

  // THE DRAWER CLOSES BY DERIVING, NOT BY AN EFFECT. It holds the pathname it
  // was opened on, so any navigation closes it for free — no effect, no
  // cascading render, and no reliance on a row's own click handler firing,
  // which a keyboard-followed link does not guarantee.
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const drawer = drawerAt === pathname;
  const setDrawer = (open: boolean) => setDrawerAt(open ? pathname : null);

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

  // The rail learns the open place from the ADDRESS, and remembers it for the
  // flat names that carry none.
  useEffect(() => {
    if (scope.place && scope.placeIsCurrent) rememberPlace(scope.place.id);
  }, [scope.place, scope.placeIsCurrent, rememberPlace]);

  // `pickPlace` WENT WITH THE SELECTOR (MESITA-1918). It carried the open
  // ADDRESS across a switch — the other venue's Orders rather than its Profile
  // — and the only caller was the rail's menu. The catalogue switches with a
  // plain link to the place's root, so the carry-across is gone with the
  // control that needed it: a list of venues you pick from lands you at the
  // top of the one you picked, which is what a list has always done.
  const rail = (
    <Sidebar
      scope={scope}
      isSuperAdmin={scenario.isSuperAdmin}
      viewerLabel={viewer.email}
      onNavigate={() => setDrawer(false)}
      // The retry a failed read offers. In the real console it re-runs the
      // Edge Function; here it puts the scenario back on a shape that has
      // places, which is the same promise kept the only way this app can.
      onRetry={() => setScenario({ mode: "solo" })}
    />
  );

  return (
    <div className="bg-background fixed inset-0 flex flex-col">
      {/* THE STRIP. Above the rail, not inside main: it must be unmissable and
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
          Nothing here is real. No backend, no account, no place — every name and
          number on this screen is invented.
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* DESKTOP RAIL — `lg:block`, the one Pato is looking at. ONE WIDTH
            (MESITA-1905): the chips-only `w-16` went with the Collapse control
            that was its only door, and with it the width transition — a rail
            that can only be one width has nothing to animate between.
            
            `w-60` → `w-68`, 240px → 272px (MESITA-1961). Pato: *"a bit more
            horizontally larger, just a bit"*. MESITA-1960 put that +32px on
            the MOBILE DRAWER below by mistake — the two containers render the
            same `rail` and nothing but a comment told them apart, so the
            change shipped green and moved nothing an operator could see.
            A width edit in this file MUST name its breakpoint and be measured
            at that breakpoint. */}
        <div className="hidden w-68 shrink-0 lg:block">{rail}</div>

        {/* Mobile drawer. */}
        {drawer && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-black/50"
            />
            {/* BACK TO `w-64` (MESITA-1961). MESITA-1960's +32px landed here
                by mistake and 288px is the wrong answer on a phone: on a 375px
                screen that is 77% of the viewport, for a sheet whose whole job
                is to leave the page visible behind it. This element was never
                the one under discussion. */}
            <div className="relative z-10 w-64">{rail}</div>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* The mobile topbar exists only to open the drawer. */}
          <div className="border-border bg-card flex h-12 shrink-0 items-center gap-2 border-b px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-lg outline-hidden focus-visible:ring-2"
            >
              {drawer ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="font-display truncate text-sm font-semibold tracking-tight">
              {scope.place?.name ?? "Console"}
            </span>
          </div>

          {/* THE ONLY SCROLLER. */}
          <main className="min-h-0 flex-1 overflow-y-auto">
            {title && <h1 className="sr-only">{title}</h1>}
            {/* FLUID: no max-width. A full-bleed child cancels SHELL_GUTTER
                with SHELL_BLEED and only reaches the column edge if nothing
                caps it. Readability is protected per-element
                (FORM_COLUMN_CLASS), not by squeezing the console. */}
            <div className={cn("flex w-full flex-col gap-4 py-4 sm:py-8", SHELL_GUTTER)}>
              {/* SUSPENSE, because pages below read `searchParams` — the
                  catalogue's `?owned=` and Stripe's stored `?connect=`. Reading
                  them opts a page out of prerendering, and without a boundary
                  the whole route is refused at build time.

                  The boundary is HERE rather than around the shell: the rail
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

      <MockPanel />
    </div>
  );
}

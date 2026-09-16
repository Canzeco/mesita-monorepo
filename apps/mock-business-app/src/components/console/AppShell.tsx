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
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/console/Sidebar";
import {
  flatPlacePageFromPathname,
  flatViewFromPathname,
  isPlacePayPathname,
  placePageFromPathname,
  placePageHref,
  placePayHref,
} from "@/lib/console-routes";
import { placeTabFromPathname, placeTabHref, tabsForAccess } from "@/lib/place-tabs";
import { MockPanel } from "@/components/console/MockPanel";
import { useMock } from "@/mock/MockStore";
import { resolveRailScope } from "@/lib/rail-scope";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { world, scenario, setScenario, lastPlaceId, rememberPlace, viewer } = useMock();
  const [collapsed, setCollapsed] = useState(false);

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

  // The rail learns the open place from the ADDRESS, and remembers it for the
  // flat names that carry none.
  useEffect(() => {
    if (scope.place && scope.placeIsCurrent) rememberPlace(scope.place.id);
  }, [scope.place, scope.placeIsCurrent, rememberPlace]);

  /** SWITCHING PLACES IS A NAVIGATION, not a preference.
   *
   *  Writing `lastPlaceId` alone did nothing at all: while a place address was
   *  open the pathname still named the OLD place, so the effect above resolved
   *  the scope from it and wrote that id straight back over the pick. The
   *  switcher looked live and moved nothing.
   *
   *  It carries the VIEW across, so switching from one venue's Orders lands on
   *  the other's Orders rather than dumping the operator back on Profile —
   *  unless the new place's role cannot open it, in which case Profile is the
   *  honest landing and beats a switch that 404s. `rememberPlace` is left to
   *  the effect: the pathname is about to name the new place, and two writers
   *  for one fact is what caused this bug. */
  function pickPlace(id: string) {
    const target = world.places.find((p) => p.id === id);
    if (!target) return;
    // THE PAYMENTS SUB-STEP FIRST, because it is the one address whose PAGE is
    // not its whole name: `placePageFromPathname` reads `/products/pay` as
    // `products`, so asking it alone would answer the catalogue and drop an
    // operator off the Stripe account they were looking at. `isPlacePayPathname`
    // exists precisely to tell the two apart.
    if (isPlacePayPathname(pathname)) {
      router.push(placePayHref(id));
      return;
    }
    const page = placePageFromPathname(pathname) ?? flatPlacePageFromPathname(pathname);
    if (page) {
      router.push(placePageHref(id, page));
      return;
    }
    const view = placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname);
    const allowed = tabsForAccess({
      held: true,
      role: target.myRole,
      isSuperAdmin: scenario.isSuperAdmin,
    });
    router.push(placeTabHref(id, view && allowed.includes(view) ? view : "profile"));
  }

  const rail = (
    <Sidebar
      scope={scope}
      places={world.places}
      isSuperAdmin={scenario.isSuperAdmin}
      accountLabel={viewer.email}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((v) => !v)}
      onNavigate={() => setDrawer(false)}
      onPickPlace={pickPlace}
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
      <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-[color:var(--brand-pink-700)] px-3 text-[11px] font-semibold tracking-wide text-white">
        <span className="rounded-sm bg-white/25 px-1.5">MOCK</span>
        <span className="truncate">
          Nothing here is real. No backend, no account, no place — every name and
          number on this screen is invented.
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Desktop rail. `w-16` is chips only. */}
        <div
          className={cn(
            "hidden shrink-0 transition-[width] duration-150 lg:block",
            collapsed ? "w-16" : "w-60",
          )}
        >
          {rail}
        </div>

        {/* Mobile drawer. */}
        {drawer && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-black/50"
            />
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

"use client";

// The console frame (MESITA-1710). Rail left, header + scroller right.
//
// Ported from apps/web-admin/src/components/AppShell.tsx, which had already
// paid for the two mistakes below. Two things changed on the way over: ONE
// breakpoint instead of two, and a focus trap the original never had.
//
// THE FRAME IS PINNED, NOT MEASURED. `fixed inset-0` resolves against the
// layout viewport — the same box `html { height: 100% }` uses — and re-resolves
// on every resize, so the shell can never disagree with the window the way a
// `100dvh` box can. Nothing is left in body flow, so the document has nothing
// to scroll: `main` below is the only scroller.
//
// `overflow-clip`, never `overflow-hidden`: a hidden box is still a scroll
// CONTAINER, so a find-in-page hit, an autoFocus, or any scrollIntoView under a
// subtree that momentarily overflows will scroll the frame — rail and content
// slide up together, dead space opens below, and with no scrollbar there is no
// way back short of a reload. Clip creates no scroll container at all.
//
// AND THIS IS WHY `TOPNAV_OCCUPIED_PX` IS GONE. PlaceBar used to park at a
// hard-coded 57px, the exact height of the bar above it. With this frame the
// header is a flex SIBLING of `main` rather than something inside it, so
// `position: sticky` inside `main` resolves against `main` — there is no
// offset left to encode. The constant did not need a new value; it stopped
// having a job. Same lesson `STATES_HEAD_STICKY` in lib/ui-classes.ts spells
// out at length: sticky resolves against the nearest SCROLLING ANCESTOR.
//
// ONE BREAKPOINT, `lg`. Admin's rail switches at `lg` and PlaceBar used to
// switch at `sm`. Two breakpoints left 640-1024px — laptop-adjacent tablets —
// showing a mobile topbar AND a bar offset for a desktop bar that was not
// there. Everything here switches at `lg` or not at all.
//
// ONE SCOPE (MESITA-1807). The rail's place is resolved here, once, from the
// pathname and the viewer payload, and handed to both rail instances and the
// header — so three pieces of chrome cannot disagree about whose console this
// is. The same resolution is what the rail cookie remembers, so the next fresh
// request paints the same rows.
//
// ONE SUBJECT, ONE COOKIE (MESITA-1892). There were two of each while an
// organization sat above the place; the layer is gone and so is its half.

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/console/Sidebar";
import { RailScopeProvider } from "@/components/console/RailScopeContext";
import { ConsoleHeader } from "@/components/console/ConsoleHeader";
import {
  RAIL_COOKIE_ATTRS,
  RAIL_PLACE_COOKIE,
} from "@/lib/sidebar-prefs";
import type { RailPlace } from "@/lib/rail-scope";
import { useRailScope } from "@/lib/use-rail-scope";

const FOCUSABLE =
  'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function AppShell({
  places,
  isSuperAdmin,
  viewerError,
  accountLabel,
  rememberedPlaceId,
  children,
}: {
  places: readonly RailPlace[];
  isSuperAdmin: boolean;
  viewerError: boolean;
  accountLabel: string;
  /** The rail cookie, read by the server layout: right on the first frame
   *  only — a shared layout does not re-run on client navigations, which is
   *  why the session's own memory (OpenPlaceProvider) beats it. */
  rememberedPlaceId: string | null;
  children: React.ReactNode;
}) {
  const scope = useRailScope({ places, rememberedPlaceId, viewerError });
  // THE MOBILE TOPBAR STATES THE SCOPE (MESITA-1842), AND STILL DOES
  // (MESITA-1909). The wordmark used to sit here AND in the rail; Pato deleted
  // both on "no mesita logo, fuck it", and has now put one back — in the RAIL
  // only. This bar keeps the scope line, because what belongs in a 44px strip
  // above a CLOSED drawer is the thing the drawer is hiding: which place every
  // screen beneath it is about. The rail's own head is inside the drawer,
  // where it is the first thing you see when you open it; repeating it out
  // here would spend the one line this bar has on the word you already know.
  // It was two names joined by a dot while an organization sat above the place
  // (MESITA-1892); one subject, one name.
  const scopeLine = scope.place?.name ?? null;
  // ONE PIECE OF CHROME STATE: the mobile drawer. There was a second — the
  // desktop rail's icon-only width — and MESITA-1909 deleted the control that
  // reached it, so the width, its cookie and its transition went too.
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Remember the scope for the next fresh request — but only the place that
  // is actually open, because the rail's fallback pick is not a visit.
  const visitedPlaceId = scope.placeIsCurrent ? (scope.place?.id ?? null) : null;
  useEffect(() => {
    if (visitedPlaceId) {
      document.cookie = `${RAIL_PLACE_COOKIE}=${visitedPlaceId}; ${RAIL_COOKIE_ATTRS}`;
    }
  }, [visitedPlaceId]);

  // Lock body scroll, close on Esc, and TRAP TAB.
  //
  // The trap is the one thing admin's shell does not do, and it is not a nicety
  // — without it Tab walks straight out of the drawer and into the page behind
  // the scrim, where a sighted keyboard user then operates controls they cannot
  // see and a screen-reader user is read a page that is visually dismissed.
  //
  // `defaultPrevented` FIRST. Radix handles Escape (and Tab) for an open
  // switcher menu on a document CAPTURE listener that runs before this one
  // and calls preventDefault() — wherever the menu is portaled (the drawer's
  // menus portal INTO the drawer since MESITA-1818; the desktop rail's go to
  // `body`). Without the guard one Esc closes the menu AND the drawer, and
  // Tab inside an open menu is fought over. The guard stays either way.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const items = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Also catches focus that is already outside the drawer entirely, which
      // is the state a mid-navigation re-render can leave behind.
      if (
        e.shiftKey &&
        (active === first || !drawerRef.current.contains(active))
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    drawerRef.current
      ?.querySelector<HTMLElement>(FOCUSABLE)
      ?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  // The rail takes the SCOPE, not the portfolio (MESITA-1918): `places` fed
  // the selector's menu, and the selector is gone. The list stays here, where
  // `useRailScope` resolves it and `RailScopeProvider` publishes it.
  const railProps = {
    scope,
    isSuperAdmin,
    viewerError,
    accountLabel,
  };

  return (
    <RailScopeProvider value={{ scope, places, isSuperAdmin }}>
    <div className="fixed inset-0 flex overflow-clip">
      {/* Desktop rail — visible lg+. ONE WIDTH (MESITA-1909): the chips-only
          `w-16` went with the Collapse button that was its only door, and the
          width transition went with the second width. The column owns the
          width; the rail fills it. */}
      <div className="hidden w-60 shrink-0 lg:flex">
        <Sidebar {...railProps} />
      </div>

      {/* Drawer — below lg.
            `inert` while closed, and that is not decoration. The panel stays
            MOUNTED so it can animate, and a closed one is hidden only by a
            translate — which removes it from view but not from the tab order.
            Without this, a keyboard user below `lg` tabs through a full set of
            invisible nav links on every screen. `aria-hidden` alone is also
            invalid here: it is illegal to hide a subtree that still contains
            focusable nodes. `inert` fixes both at once, so aria-hidden rides
            along only as an older-browser fallback. */}
      <div
        className={
          "fixed inset-0 z-50 lg:hidden " +
          (open ? "pointer-events-auto" : "pointer-events-none")
        }
        inert={!open}
        aria-hidden={!open}
      >
        <div
          className={
            "bg-foreground/40 absolute inset-0 backdrop-blur-sm transition-opacity duration-200 " +
            (open ? "opacity-100" : "opacity-0")
          }
          onClick={close}
        />
        <div
          ref={drawerRef}
          className={
            // w-60 matches the expanded rail — anything wider and the rail
            // underfills the panel.
            "relative h-full w-60 max-w-[85vw] shadow-lg transition-transform duration-200 ease-out " +
            (open ? "translate-x-0" : "-translate-x-full")
          }
          role="dialog"
          aria-modal="true"
          aria-label="Console navigation"
        >
          <Sidebar {...railProps} onNavigate={close} />
          {open && (
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="border-border bg-card text-muted-foreground hover:text-foreground absolute top-3 -right-12 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile topbar — hidden lg+ */}
        <header className="border-border bg-card flex shrink-0 items-center gap-3 border-b px-4 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="border-border text-foreground hover:bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition"
          >
            <Menu className="h-4 w-4" />
          </button>
          {/* Text, not a link: the drawer beside it IS the navigation, and a
              second door to a page one tap away is how a bar starts competing
              with the nav it opens. Empty until a place resolves — a bar that
              says "Place" states nothing. */}
          {scopeLine && (
            <span className="text-foreground truncate text-sm font-medium">
              {scopeLine}
            </span>
          )}
        </header>

        <ConsoleHeader scope={scope} />

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </RailScopeProvider>
  );
}

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
// ONE SCOPE (MESITA-1807). The rail's organization and place are resolved
// here, once, from the pathname and the viewer payload, and handed to both
// rail instances and the header — so three pieces of chrome cannot disagree
// about whose console this is. The same resolution is what the two rail
// cookies remember, so the next fresh request paints the same boxes.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { Sidebar } from "@/components/console/Sidebar";
import { RailScopeProvider } from "@/components/console/RailScopeContext";
import { ConsoleHeader } from "@/components/console/ConsoleHeader";
import { useOpenPlaceGuard } from "@/components/console/OpenPlace";
import { SHELL_ROUTES } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import {
  RAIL_COOKIE_ATTRS,
  RAIL_ORG_COOKIE,
  RAIL_PLACE_COOKIE,
  SIDEBAR_COLLAPSED_COOKIE,
} from "@/lib/sidebar-prefs";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import type { RailOrg } from "@/lib/rail-scope";
import { useRailScope } from "@/lib/use-rail-scope";

const FOCUSABLE =
  'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function AppShell({
  organizations,
  isSuperAdmin,
  viewerError,
  accountLabel,
  rememberedPlaceId,
  rememberedOrgId,
  defaultCollapsed = false,
  children,
}: {
  organizations: readonly RailOrg[];
  isSuperAdmin: boolean;
  viewerError: boolean;
  accountLabel: string;
  /** The rail cookies, read by the server layout: right on the first frame
   *  only — a shared layout does not re-run on client navigations, which is
   *  why the session's own memory (OpenPlaceProvider) beats them. */
  rememberedPlaceId: string | null;
  rememberedOrgId: string | null;
  /** Read from the cookie by the server layout, so the rail paints at its
   *  final width on the first frame. */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const scope = useRailScope({ organizations, rememberedPlaceId, rememberedOrgId });
  // Where the wordmark lands: the same answer `/` gives, resolved here so the
  // click costs no redirect hop.
  const landingHref = scope.place
    ? placeTabHref(scope.place.id, "profile")
    : scope.org
      ? SHELL_ROUTES.account
      : SHELL_ROUTES.orgNew;
  // The mobile wordmark is a route out of the place screen exactly like the
  // rail's rows are, so it answers to the same guard. OpenPlaceProvider is
  // mounted by the LAYOUT rather than here, so this hook can see it.
  const guardNav = useOpenPlaceGuard();
  // Two independent pieces of state, easy to confuse: `open` is the mobile
  // drawer, `collapsed` is the desktop rail's icon-only width. The drawer never
  // collapses — at that size the whole rail is already hidden by default.
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Remember the scope for the next fresh request. The place only when it is
  // the one actually open — the rail's fallback pick is not a visit.
  const orgId = scope.org?.id ?? null;
  const visitedPlaceId = scope.placeIsCurrent ? (scope.place?.id ?? null) : null;
  useEffect(() => {
    if (orgId) {
      document.cookie = `${RAIL_ORG_COOKIE}=${orgId}; ${RAIL_COOKIE_ATTRS}`;
    }
    if (visitedPlaceId) {
      document.cookie = `${RAIL_PLACE_COOKIE}=${visitedPlaceId}; ${RAIL_COOKIE_ATTRS}`;
    }
  }, [orgId, visitedPlaceId]);

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

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    // A year-long cookie rather than localStorage: the server layout reads it
    // during render, so a reload comes back at the width you left it.
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; ${RAIL_COOKIE_ATTRS}`;
  };

  const railProps = {
    scope,
    organizations,
    isSuperAdmin,
    viewerError,
    accountLabel,
    landingHref,
  };

  return (
    <RailScopeProvider value={{ scope, organizations, isSuperAdmin }}>
    <div className="fixed inset-0 flex overflow-clip">
      {/* Desktop rail — visible lg+. The column owns the width; the rail fills it. */}
      <div
        className={
          "hidden shrink-0 transition-[width] duration-200 ease-out lg:flex " +
          (collapsed ? "w-16" : "w-60")
        }
      >
        <Sidebar
          {...railProps}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
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
          <Link
            href={landingHref}
            onClick={(e) => guardNav?.(landingHref, e)}
            className="inline-flex items-center gap-2 truncate"
          >
            <MesitaLogo variant="horizontal" className="h-5 w-auto" />
            <span className={TINY_LABEL_CLASS}>business</span>
          </Link>
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

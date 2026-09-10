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

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { Sidebar } from "@/components/console/Sidebar";
import { ConsoleHeader } from "@/components/console/ConsoleHeader";
import { OpenPlaceProvider } from "@/components/console/OpenPlace";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { useActiveOrg, type ChromeOrg } from "@/lib/use-active-org";

const FOCUSABLE =
  'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function AppShell({
  organizations,
  defaultCollapsed = false,
  children,
}: {
  organizations: ChromeOrg[];
  /** Read from the cookie by the server layout, so the rail paints at its
   *  final width on the first frame. */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  // Every href in this frame carries the active organization, resolved the one
  // way — dropping it on a single link is enough to switch a multi-org
  // operator's context out from under them.
  const { activeOrgId } = useActiveOrg(organizations);
  // Two independent pieces of state, easy to confuse: `open` is the mobile
  // drawer, `collapsed` is the desktop rail's icon-only width. The drawer never
  // collapses — at that size the whole rail is already hidden by default.
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll, close on Esc, and TRAP TAB.
  //
  // The trap is the one thing admin's shell does not do, and it is not a nicety
  // — without it Tab walks straight out of the drawer and into the page behind
  // the scrim, where a sighted keyboard user then operates controls they cannot
  // see and a screen-reader user is read a page that is visually dismissed.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
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
      if (e.shiftKey && (active === first || !drawerRef.current.contains(active))) {
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
    document.cookie = `business_sidebar_collapsed=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <OpenPlaceProvider>
      <div className="fixed inset-0 flex overflow-clip">
        {/* Desktop rail — visible lg+. The column owns the width; the rail fills it. */}
        <div
          className={
            "hidden shrink-0 transition-[width] duration-200 ease-out lg:flex " +
            (collapsed ? "w-16" : "w-60")
          }
        >
          <Sidebar
            organizations={organizations}
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
            <Sidebar organizations={organizations} onNavigate={close} />
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
              href={withOrg(SHELL_ROUTES.organization, activeOrgId)}
              className="inline-flex items-center gap-2 truncate"
            >
              <MesitaLogo variant="horizontal" className="h-5 w-auto" />
              <span className={TINY_LABEL_CLASS}>business</span>
            </Link>
          </header>

          <ConsoleHeader organizations={organizations} />

          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </OpenPlaceProvider>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { SidebarWithSuspense } from "@/components/SidebarWithSuspense";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar-prefs";

type AppShellProps = {
  children: React.ReactNode;
  /** Read from the cookie by the server layout, so the rail paints correctly first frame. */
  defaultCollapsed?: boolean;
};

// Admin shell wrapper: desktop renders the Sidebar in a static column,
// mobile/tablet (< lg) collapses it into a slide-in drawer triggered from a
// topbar hamburger. Drawer closes on link navigation (onNavigate passed
// to Sidebar), backdrop click, the close button, or Esc.
//
// Two independent pieces of state, easy to confuse: `open` is the mobile
// drawer, `collapsed` is the desktop rail's icon-only width. The drawer never
// collapses — at that size the whole rail is already hidden by default.
export function AppShell({ children, defaultCollapsed = false }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Lock body scroll while drawer is open, and close on Esc.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
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
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  // THE FRAME IS PINNED, NOT MEASURED. `fixed inset-0` resolves against the
  // layout viewport — the same box `html { height: 100% }` uses — and
  // re-resolves on every resize, so the shell can never disagree with the
  // window the way a `100dvh` box can. Nothing is left in body flow, so the
  // document has nothing to scroll: `main` below is the only scroller.
  //
  // `overflow-clip`, never `overflow-hidden`: a hidden box is still a scroll
  // CONTAINER, so a find-in-page hit, an autoFocus, or any scrollIntoView
  // under a subtree that momentarily overflows will scroll the frame — rail
  // and content slide up together, dead space opens below, and with no
  // scrollbar there is no way back short of a reload. Clip creates no scroll
  // container at all, so that cannot happen.
  return (
    <div className="fixed inset-0 flex overflow-clip">
      {/* Desktop sidebar — visible lg+. The column owns the width; the rail fills it. */}
      <div
        className={
          "hidden shrink-0 transition-[width] duration-200 ease-out lg:flex " +
          (collapsed ? "w-16" : "w-60")
        }
      >
        <SidebarWithSuspense
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </div>

      {/* Mobile / tablet drawer */}
      <div
        className={
          "lg:hidden fixed inset-0 z-50 " +
          (open ? "pointer-events-auto" : "pointer-events-none")
        }
        aria-hidden={!open}
      >
        <div
          className={
            "absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-200 " +
            (open ? "opacity-100" : "opacity-0")
          }
          onClick={close}
        />
        <div
          className={
            // w-60 matches the expanded rail — at w-64 the rail underfilled the
            // panel and the close button floated off its edge.
            "relative h-full w-60 max-w-[85vw] shadow-elev transition-transform duration-200 ease-out " +
            (open ? "translate-x-0" : "-translate-x-full")
          }
          role="dialog"
          aria-label="Admin navigation"
        >
          <SidebarWithSuspense onNavigate={close} />
          {open && (
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="border-border bg-card text-muted-foreground hover:text-foreground absolute top-3 -right-12 flex h-9 w-9 items-center justify-center rounded-full border shadow-card transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        {/* Mobile / tablet topbar — hidden lg+ */}
        <header className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/75 sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b px-4 py-2.5 backdrop-blur lg:hidden">
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
            href="/central"
            className="inline-flex items-center gap-2 truncate"
          >
            <MesitaLogo
              variant="horizontal"
              className="text-primary h-5 w-auto"
            />
            <span className="text-muted-foreground type-meta font-medium tracking-[0.14em] uppercase">
              admin
            </span>
          </Link>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

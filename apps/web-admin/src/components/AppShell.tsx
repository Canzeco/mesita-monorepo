"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { SidebarWithSuspense } from "@/components/SidebarWithSuspense";

type AppShellProps = {
  children: React.ReactNode;
};

// Admin shell wrapper: desktop renders the Sidebar in a static column,
// mobile/tablet (< lg) collapses it into a slide-in drawer triggered from a
// topbar hamburger. Drawer closes on link navigation (onNavigate passed
// to Sidebar), backdrop click, the close button, or Esc.
export function AppShell({ children }: AppShellProps) {
  const [open, setOpen] = useState(false);

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

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar — visible lg+ */}
      <div className="hidden shrink-0 lg:flex">
        <SidebarWithSuspense />
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
            "relative h-full w-64 max-w-[85vw] shadow-elev transition-transform duration-200 ease-out " +
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
              className="border-border bg-card text-muted-foreground hover:text-foreground absolute top-3 -right-12 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile / tablet topbar — hidden lg+ */}
        <header className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/75 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="border-border text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-full border transition"
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
            <span className="text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase">
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

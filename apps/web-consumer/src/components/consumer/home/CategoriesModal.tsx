"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";

// THE CATEGORIES MODAL (Pato, 2026-11-18, MESITA-4417: "for menu actually
// open a modal covering full page"): Home's Menu tile opens every family
// over the whole card, rising from the bottom: a header with the title and
// an X, then the row's circles four to a line, scrolling. A pick, the X or
// Escape closes it. It replaced a panel dropped over the blurred rows
// (MESITA-4410). A sheet by Pato's call, against MESITA-4094's no-sheets
// rule (as Offers was, MESITA-4224).
// THE TWO SPECIALS FIRST (Pato, MESITA-4417: "first the 2 specials … then
// 4 items per row"): Saved and Top, which are not families, side by side
// on top as two wide tiles; then the families, four to a line.
export function CategoriesModal({
  open,
  onClose,
  specials,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Saved and Top as wide tiles (Top alone for an anonymous visitor). */
  specials: ReactNode;
  /** The family tiles, drawn by Home's row so both look the same. */
  children: ReactNode;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Categories" fullScreen>
      <header className="bg-card border-border flex h-14 shrink-0 items-center border-b pr-1.5 pl-4">
        <h2 className="text-foreground flex-1 text-base font-semibold">Categories</h2>
        <button
          type="button"
          aria-label="Close categories"
          onClick={onClose}
          className="text-foreground hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition"
        >
          <X className="h-6 w-6" strokeWidth={2.25} />
        </button>
      </header>
      <nav
        aria-label="All categories"
        className="bg-card scrollbar-thin-dark flex min-h-0 flex-1 flex-col overflow-y-auto"
        data-places-menu
      >
        <div className="border-border grid shrink-0 grid-cols-2 gap-2 border-b p-4" data-places-menu-specials>
          {specials}
        </div>
        <div className="grid shrink-0 grid-cols-4 content-start gap-x-1 gap-y-4 px-2 py-4">
          {children}
        </div>
      </nav>
    </LocalSheet>
  );
}

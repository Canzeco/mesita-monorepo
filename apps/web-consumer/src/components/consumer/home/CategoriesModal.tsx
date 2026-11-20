"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// THE CATEGORIES MODAL (Pato, 2026-11-18, MESITA-4417: "for menu actually
// open a modal covering full page"): Home's Menu tile opens every family
// over the whole card, rising from the bottom: a header with the title and
// an X, then the row's circles four to a line, scrolling. A pick, the X or
// Escape closes it. It replaced a panel dropped over the blurred rows
// (MESITA-4410). A sheet by Pato's call, against MESITA-4094's no-sheets
// rule (as Offers was, MESITA-4224).
// THE SPECIALS FIRST (Pato, MESITA-4417: "first the 2 specials … then
// 4 items per row"): Saved, Nearby and Popular, which are not families,
// then the families, five to a line (Pato, MESITA-4418: "use 5 columns,
// not 4"). CIRCLES, NOT WIDE TILES (Pato, MESITA-4469: "those three top
// special buttons must be circles not squares"): the same circle and the
// name under it as every family. The wide tiles (MESITA-4419) are gone.
export function CategoriesModal({
  open,
  onClose,
  specials,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Saved, Nearby and Popular as circles, the same as the families
   *  (no Saved for an anonymous visitor). */
  specials: ReactNode;
  /** The family tiles, drawn by Home's row so both look the same. */
  children: ReactNode;
}) {
  return (
    // FLOATING (Pato, 2026-11-18, MESITA-4433: "build the modal better.
    // modal floating"): the app's floating card, 20px in from every edge,
    // rounded, over the dimmed Home; it scales in. Full screen before.
    <LocalDialog open={open} onClose={onClose} ariaLabel="Categories" fit>
      <header className="border-border flex h-14 shrink-0 items-center border-b pr-1.5 pl-5">
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
        className="scrollbar-thin-dark flex min-h-0 flex-1 flex-col overflow-y-auto"
        data-places-menu
      >
        <div className="grid shrink-0 grid-cols-5 content-start gap-x-0.5 px-1.5 pt-3" data-places-menu-specials>
          {specials}
        </div>
        <div className="grid shrink-0 grid-cols-5 content-start gap-x-0.5 gap-y-3 px-1.5 pt-3 pb-4">
          {children}
        </div>
      </nav>
    </LocalDialog>
  );
}

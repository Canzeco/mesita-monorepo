import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared presentational primitives for the two Filters sheets — Feed + Scroll
// (DiscoveryFilters) and the Search map (SearchMapFilters): the sheet's header
// and footer, the module box, and the Pill. Dense on purpose — both sheets
// must fit without scrolling.

/** Sheet title row: Filters, then Reset and Close. */
export function FiltersSheetHeader({
  onReset,
  onClose,
}: {
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
      <div className="flex items-center gap-2.5">
        <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
        <p className="font-display text-lg leading-tight font-semibold tracking-tight">
          Filters
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex min-h-11 items-center rounded-full px-3 text-xs font-medium transition"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-11 w-11 items-center justify-center rounded-full transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Sheet action row: show the matches, reset a cut that emptied them, or Done. */
export function FiltersSheetFooter({
  count,
  hasPredicates,
  onReset,
  onClose,
}: {
  count: number | null;
  hasPredicates: boolean;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border-border/60 shrink-0 border-t px-4 py-3">
      {count != null && count > 0 ? (
        <Button
          type="button"
          size="lg"
          onClick={onClose}
          className="shadow-glow w-full text-sm font-semibold"
        >
          Show {count} {count === 1 ? "place" : "places"}
        </Button>
      ) : count === 0 && hasPredicates ? (
        <button
          type="button"
          onClick={onReset}
          className="bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.99]"
        >
          No matches — reset filters
        </button>
      ) : count === 0 ? (
        <div className="bg-muted/60 text-muted-foreground flex h-12 w-full items-center justify-center rounded-xl text-sm font-medium">
          No places to show
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          onClick={onClose}
          className="shadow-glow w-full text-sm font-semibold"
        >
          Done
        </Button>
      )}
    </div>
  );
}

/** Bordered module box, one per filter group. */
export function FilterModule({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-3">
      <p className="type-label text-muted-foreground mb-2 font-semibold tracking-wide">
        {label}
      </p>
      {children}
    </section>
  );
}

// Soft borderless pill — muted at rest, brand gradient when selected. Compact
// so every option stays visible in the dense sheets.
export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "type-meta flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium whitespace-nowrap transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient shadow-glow-sm text-white"
          : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

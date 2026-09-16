"use client";

// THE SELECTOR HEADS THE RAIL — at solo and at multi, and never at zero or
// unknown.
//
// At one place it is not a switcher and still belongs there: it is the rail's
// statement of WHAT the column below is about. Deleting it at solo was tried
// and it made the eight rows read as the console's own, rather than as this
// venue's. At zero there is nothing to name, and at unknown naming one would be
// inventing the answer a failed read did not give.
//
// It wears the place's PHOTO, not an icon: a photo is what distinguishes one
// venue from another, and an icon would be identical on all of them.
//
// At `w-16` it collapses to its chip alone, like every row below it.
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Layers, Plus, Store } from "lucide-react";
import { SHELL_ROUTES } from "@/lib/console-routes";
import type { RailPlace } from "@/lib/rail-scope";
import { cn } from "@/lib/utils";

const CHIP = "h-6 w-6 shrink-0 rounded-md object-cover";

export function PlaceChip({
  photoUrl,
  size = "rail",
}: {
  photoUrl: string | null;
  size?: "rail" | "menu";
}) {
  const cls = size === "menu" ? "h-5 w-5 shrink-0 rounded-md object-cover" : CHIP;
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a data-URI chip; next/image's layout cost buys nothing here
    return <img src={photoUrl} alt="" className={cls} />;
  }
  return (
    <span
      aria-hidden
      className={cn(cls, "bg-sidebar-accent text-sidebar-muted flex items-center justify-center")}
    >
      <Store className="h-3 w-3" />
    </span>
  );
}

export function RailSelector({
  current,
  places,
  collapsed,
  onPick,
}: {
  current: RailPlace | null;
  places: readonly RailPlace[];
  collapsed: boolean;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const matches = places.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  // THE MULTI CASE WITH NOTHING SELECTED IS NOT AN ERROR. A portfolio of four
  // and no place named by the address means the console has correctly declined
  // to pick one, and the trigger says "Pick a place" rather than showing the
  // first.
  const label = current?.name ?? "Pick a place";

  return (
    <div ref={boxRef} className="relative mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          "text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold outline-hidden transition focus-visible:ring-2",
          collapsed && "justify-center px-0",
        )}
      >
        <PlaceChip photoUrl={current?.photoUrl ?? null} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ChevronsUpDown className="text-sidebar-muted h-3.5 w-3.5 shrink-0" aria-hidden />
          </>
        )}
        <span className="sr-only">{collapsed ? label : ""}</span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="border-sidebar-border bg-sidebar absolute top-full left-0 z-50 mt-1 w-[248px] rounded-xl border p-1 shadow-xl"
        >
          {places.length > 4 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a place"
              className="text-sidebar-foreground placeholder:text-sidebar-muted focus-visible:ring-sidebar-ring mb-1 h-8 w-full rounded-lg bg-white/10 px-2 text-[13px] outline-hidden focus-visible:ring-2"
            />
          )}
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === current?.id}
              onClick={() => {
                onPick(p.id);
                setOpen(false);
              }}
              className="text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] outline-hidden focus-visible:ring-2"
            >
              <PlaceChip photoUrl={p.photoUrl} size="menu" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === current?.id && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            </button>
          ))}
          {matches.length === 0 && (
            <p className="text-sidebar-muted px-2 py-2 text-[12px]">No places match.</p>
          )}
          <div className="border-sidebar-border/60 mt-1 border-t pt-1">
            <Link
              href={SHELL_ROUTES.places}
              onClick={() => setOpen(false)}
              className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden />
              All places
            </Link>
            <Link
              href={SHELL_ROUTES.placesNew}
              onClick={() => setOpen(false)}
              className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add your place
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { Clock, Dices, MapPin, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  patchDiscoveryFilters,
  resetDiscoveryFilters,
  toggleDiscoveryFamily,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";

// Shared body of the discovery FilterSheet (Home Swipe + Search map) — the
// MESITA-646 simplification of MESITA-632's four-card sheet. One control
// language (pills), no in-sheet navigation, no sliders, and every control
// filters for real, client-side (discovery-filters-engine):
//   Type — the six place families (MESITA-635), multi-select, empty = all.
//   Zone — "Near me" (= no zone constraint; ranking is already
//          distance-aware) + zones derived from the catalog the host is
//          actually showing, so no pick can ever be a dead end.
//   Open now / Surprise me — standalone toggles. Surprise is Swipe-only
//          (it shuffles the deck; a map can't be shuffled), so the map
//          host hides it.
// State lives in the ONE shared store (use-discovery-filters): both surfaces
// and both trigger dots read the same filters. Live-apply — every tap
// narrows immediately; the footer CTA is feedback (real count) + close, and
// flips to a reset action when the filters exclude everything.

export function DiscoveryFilters({
  onClose,
  zones,
  count,
  showSurprise = false,
}: {
  onClose: () => void;
  /** Zones present in the host's catalog, most places first. */
  zones: string[];
  /** How many places the current filters leave visible on the host. */
  count: number;
  /** Swipe shows the Surprise-me toggle; the map hides it. */
  showSurprise?: boolean;
}) {
  const filters = useDiscoveryFilters();

  // A persisted zone can predate the current catalog (other surface, older
  // session). Surface it as an extra active pill so the selection is never
  // invisible — tapping it (or Near me) clears it.
  const staleZone =
    filters.zone !== null && !zones.includes(filters.zone) ? filters.zone : null;

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header — the sheet's ONE tinted icon circle + Reset ghost + close. */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-3">
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
            onClick={resetDiscoveryFilters}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full px-3 py-1.5 text-xs font-medium transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-8 w-8 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <SectionLabel>Type</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {PLACE_FAMILIES.map((family) => (
            <Pill
              key={family.key}
              active={filters.familyKeys.includes(family.key)}
              onClick={() => toggleDiscoveryFamily(family.key)}
            >
              {family.emoji} {family.label}
            </Pill>
          ))}
        </div>

        {(zones.length > 0 || staleZone) && (
          <>
            <SectionLabel className="mt-5">Zone</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              <Pill
                active={filters.zone === null}
                onClick={() => patchDiscoveryFilters({ zone: null })}
              >
                <MapPin className="h-3.5 w-3.5" /> Near me
              </Pill>
              {zones.map((zone) => (
                <Pill
                  key={zone}
                  active={filters.zone === zone}
                  onClick={() => patchDiscoveryFilters({ zone })}
                >
                  {zone}
                </Pill>
              ))}
              {staleZone && (
                <Pill
                  active
                  onClick={() => patchDiscoveryFilters({ zone: null })}
                >
                  {staleZone}
                </Pill>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-1.5">
          <Pill
            active={filters.openNow}
            onClick={() => patchDiscoveryFilters({ openNow: !filters.openNow })}
          >
            <Clock className="h-3.5 w-3.5" /> Open now
          </Pill>
          {showSurprise && (
            <Pill
              active={filters.surprise}
              onClick={() =>
                patchDiscoveryFilters({ surprise: !filters.surprise })
              }
            >
              <Dices className="h-3.5 w-3.5" /> Surprise me
            </Pill>
          )}
        </div>
      </div>

      {/* Footer CTA — live count feedback + close; a zero-match state flips
          it into the reset escape so the dead end is one tap deep. */}
      <div className="border-border/60 shrink-0 border-t p-4">
        {count > 0 ? (
          <button
            type="button"
            onClick={onClose}
            className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            Show {count} {count === 1 ? "place" : "places"}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetDiscoveryFilters}
            className="bg-foreground text-background flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.99]"
          >
            No matches — reset filters
          </button>
        )}
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide",
        className,
      )}
    >
      {children}
    </p>
  );
}

// Soft borderless pill — muted at rest, brand gradient when selected.
// min-h-11 keeps every filter control at the 44px touch floor.
function Pill({
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
        "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient text-white shadow-sm"
          : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

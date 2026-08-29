"use client";

import type { ReactNode } from "react";
import { Clock, Compass, SlidersHorizontal } from "lucide-react";

import type { DiscoveryFilters } from "@/lib/discovery-filters-engine";
import { hasDiscoveryPredicates } from "@/lib/discovery-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";
import { countryBarChip } from "@/lib/search-scope";
import {
  setDiscoveryContext,
  setDiscoveryWhen,
  toggleDiscoveryFamily,
} from "@/lib/use-discovery-filters";
import { cn } from "@/lib/utils";

// Compact chip strip beside the Search bar — same row, never inside
// the pill, never a cuisine-icon strip. Filters (the Discovery sheet)
// leads; the six What families follow as categories; Now / Visit /
// scope trail. Rest chips are borderless card pills; active is the
// pink gradient.

const FAMILY_STRIP: Record<FamilyKey, string> = {
  restaurants: "Restaurants",
  bars_nightlife: "Bars",
  cafes_bakeries: "Cafés",
  wellness_spa: "Wellness",
  experiences: "Experiences",
  culture_arts: "Culture",
};

function StripChip({
  active,
  onClick,
  children,
  ariaLabel,
  ariaHaspopup,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaHaspopup?: "dialog";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaHaspopup ? undefined : active}
      aria-label={ariaLabel}
      aria-haspopup={ariaHaspopup}
      className={cn(
        "type-label flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold whitespace-nowrap backdrop-blur transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient text-white shadow-glow-sm"
          : "bg-card/95 text-foreground/80 shadow-rest",
      )}
    >
      {children}
    </button>
  );
}

export function SearchFilterRow({
  filters,
  countryCode,
  locationSet,
  onOpenScope,
  onOpenFilters,
}: {
  filters: DiscoveryFilters;
  countryCode: string | null;
  locationSet: boolean;
  onOpenScope: () => void;
  onOpenFilters: () => void;
}) {
  const nowOn = filters.when.mode === "now";
  const visitOn = filters.context === "visit";
  const filtersOn = hasDiscoveryPredicates(filters);
  const scopeLabel = [
    countryCode ?? "any country",
    locationSet ? "location set" : "location not set",
  ].join(", ");

  return (
    <div
      className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-0.5"
      role="toolbar"
      aria-label="Search filters"
    >
      <StripChip
        active={filtersOn}
        onClick={onOpenFilters}
        ariaLabel="Filters"
        ariaHaspopup="dialog"
      >
        <SlidersHorizontal className="h-3 w-3" aria-hidden />
        Filters
      </StripChip>
      {PLACE_FAMILIES.map((family) => (
        <StripChip
          key={family.key}
          active={filters.familyKeys.includes(family.key)}
          onClick={() => toggleDiscoveryFamily(family.key)}
          ariaLabel={family.label}
        >
          {FAMILY_STRIP[family.key]}
        </StripChip>
      ))}
      <StripChip
        active={nowOn}
        onClick={() =>
          setDiscoveryWhen({ mode: nowOn ? "anytime" : "now" })
        }
      >
        <Clock className="h-3 w-3" aria-hidden />
        Now
      </StripChip>
      <StripChip
        active={visitOn}
        onClick={() => setDiscoveryContext(visitOn ? "any" : "visit")}
      >
        Visit
      </StripChip>
      <StripChip
        active={false}
        onClick={onOpenScope}
        ariaLabel={scopeLabel}
        ariaHaspopup="dialog"
      >
        <span className="min-w-[1.25rem] text-center tracking-wide">
          {countryBarChip(countryCode)}
        </span>
        <Compass
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            "h-3 w-3",
            locationSet ? "text-primary" : "text-muted-foreground/50",
          )}
        />
      </StripChip>
    </div>
  );
}

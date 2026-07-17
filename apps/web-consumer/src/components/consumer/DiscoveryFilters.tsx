"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  RandomnessSection,
  WhatSection,
  WhenSection,
  WhereSection,
} from "./discovery-filters-sections";
import type { FamilyKey } from "@/lib/place-families";

// Shared body of the discovery FilterSheet (Home Swipe + Search map) —
// un-parks the FiltersComingSoon panel from MESITA-249 with the real four
// filters: Where (hierarchical zones + near me), When (hour), What (the six
// place families — MESITA-635), Randomness (1–10). Visual language: one bordered
// card per filter with a differentiated tinted icon circle + live value
// pill; Near me / Anywhere are mode cards; zone and category chips are soft
// borderless pills that go brand-gradient when selected.
//
// FRONTEND-ONLY (MESITA-632): selections are local component state and are
// NOT applied to the deck / map yet — the recommender wiring lands with the
// filtering backend. Both host sheets mount this with keepMounted so
// selections survive a close. The one thing that DOES leave the sheet is
// `onActiveChange` (MESITA-633): fired on every change with whether any
// filter deviates from the defaults, so hosts can dot their trigger.

const DEFAULT_RANDOMNESS = 5;

type FiltersState = {
  /** Where — "near me" (default) or a zone-tree selection. */
  nearMe: boolean;
  /** Selected zone node id; null = anywhere. Only meaningful when !nearMe. */
  selectedZoneId: string | null;
  /** Drill path through the tree (breadcrumb) — browsing, not selection. */
  pathIds: string[];
  /** When — "now" (default) or the fixed `hour`. */
  whenNow: boolean;
  hour: number;
  /** What — multi-select place families; empty = every family. */
  familyKeys: FamilyKey[];
  /** Randomness — 1 plays it safe, 10 is full surprise. */
  randomness: number;
};

// Seeded client-side only (the sheet portals in after mount), so Date here
// can't desync hydration.
function defaultFiltersState(): FiltersState {
  return {
    nearMe: true,
    selectedZoneId: null,
    pathIds: [],
    whenNow: true,
    hour: new Date().getHours(),
    familyKeys: [],
    randomness: DEFAULT_RANDOMNESS,
  };
}

// "Any filter set?" — drives the trigger dot on both surfaces. The drill
// path and the parked hour don't count: browsing zones without picking one
// (or moving the slider and tapping Now again) leaves nothing applied.
function filtersAreActive(state: FiltersState): boolean {
  return (
    !state.nearMe ||
    !state.whenNow ||
    state.familyKeys.length > 0 ||
    state.randomness !== DEFAULT_RANDOMNESS
  );
}

export function DiscoveryFilters({
  onClose,
  onActiveChange,
}: {
  onClose: () => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const [state, setState] = useState<FiltersState>(defaultFiltersState);

  // Every mutation funnels through here so active-ness is reported in the
  // same event tick (no effects — react-hooks/set-state-in-effect).
  const patch = (partial: Partial<FiltersState>) => {
    const next = { ...state, ...partial };
    setState(next);
    onActiveChange?.(filtersAreActive(next));
  };

  const reset = () => patch(defaultFiltersState());

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header — tinted icon circle + Reset ghost + close. */}
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
            onClick={reset}
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

      <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-1 pb-4">
        <WhereSection
          nearMe={state.nearMe}
          selectedZoneId={state.selectedZoneId}
          pathIds={state.pathIds}
          onPatch={patch}
        />
        <WhenSection
          whenNow={state.whenNow}
          hour={state.hour}
          onPatch={patch}
        />
        <WhatSection familyKeys={state.familyKeys} onPatch={patch} />
        <RandomnessSection randomness={state.randomness} onPatch={patch} />
      </div>

      {/* Footer CTA — presentational for now: applying just closes the
          sheet (selections persist via keepMounted). */}
      <div className="border-border/60 shrink-0 border-t p-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition active:scale-[0.99]"
        >
          Show places
        </button>
      </div>
    </div>
  );
}

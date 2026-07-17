"use client";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";
import type {
  CategoryOption,
  WhereOption,
} from "@/lib/discovery-filters-engine";

// Discovery filters (MESITA-646/650, module order MESITA-660): the shared
// four-module sheet — Where · When · What · Randomness — opened from the
// Filter button in the swipe action bar and from the Search bar's tune icon.
// Rides the shared LocalSheet (portals into the app card, animated
// open/close, ESC). Filter state lives in the global use-discovery-filters
// store — not in the sheet — so it survives close/unmount, is identical on
// both surfaces, and hosts derive their trigger dot from the same store.

export function FilterSheet({
  open,
  onClose,
  ariaLabel = "Discovery filters",
  whereOptions,
  categoryOptions,
  count,
  hasLocation,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  /** Cities + their zones present in the host's catalog, biggest first. */
  whereOptions: WhereOption[];
  /** Concrete categories present in the host's catalog, biggest first. */
  categoryOptions: CategoryOption[];
  /** How many places the current filters leave visible on the host. */
  count: number;
  /** Geolocation granted — enables the Here distance tolerance. */
  hasLocation: boolean;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={ariaLabel}>
      <DiscoveryFilters
        onClose={onClose}
        whereOptions={whereOptions}
        categoryOptions={categoryOptions}
        count={count}
        hasLocation={hasLocation}
      />
    </LocalSheet>
  );
}

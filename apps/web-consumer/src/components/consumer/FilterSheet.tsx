"use client";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";
import type { CategoryOption } from "@/lib/discovery-filters-engine";

// Discovery filters (MESITA-646/650, five-parameter rebuild MESITA-672): the
// shared sheet — Where · Distance · When · What · Randomness — opened from the
// Filter button in the swipe action bar and from the Search bar's tune icon.
// Rides the shared LocalSheet (portals into the app card, animated open/close,
// ESC). Filter state lives in the global use-discovery-filters store — not in
// the sheet — so it survives close/unmount, is identical on both surfaces, and
// hosts derive their trigger dot from the same store. The Where search is
// self-contained in the sheet, so hosts only pass the catalog-derived category
// options + the live count + whether device location is available.

export function FilterSheet({
  open,
  onClose,
  ariaLabel = "Discovery filters",
  categoryOptions,
  count,
  hasLocation,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  /** Concrete categories present in the host's catalog, biggest first. */
  categoryOptions: CategoryOption[];
  /** How many places the current filters leave visible on the host. */
  count: number;
  /** Geolocation granted — enables the "distance from me" default. */
  hasLocation: boolean;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={ariaLabel}>
      <DiscoveryFilters
        onClose={onClose}
        categoryOptions={categoryOptions}
        count={count}
        hasLocation={hasLocation}
      />
    </LocalSheet>
  );
}

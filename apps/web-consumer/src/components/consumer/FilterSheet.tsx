"use client";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";

// Discovery filters (MESITA-646): the shared flat pill sheet, opened from the
// Filter button in the swipe action bar and from the Search bar's tune icon.
// Rides the shared LocalSheet (portals into the app card, animated
// open/close, ESC). Filter state lives in the global use-discovery-filters
// store — not in the sheet — so it survives close/unmount, is identical on
// both surfaces, and hosts derive their trigger dot from the same store
// (no keepMounted, no onActiveChange plumbing).

export function FilterSheet({
  open,
  onClose,
  ariaLabel = "Discovery filters",
  zones,
  count,
  showSurprise = false,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  /** Zones present in the host's catalog, most places first. */
  zones: string[];
  /** How many places the current filters leave visible on the host. */
  count: number;
  /** Swipe shows the Surprise-me toggle; the map hides it. */
  showSurprise?: boolean;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={ariaLabel}>
      <DiscoveryFilters
        onClose={onClose}
        zones={zones}
        count={count}
        showSurprise={showSurprise}
      />
    </LocalSheet>
  );
}

"use client";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";

// Discovery filters — un-parked (MESITA-632): the shared Where / When /
// What / Randomness panel, opened from the Filter button in the swipe
// action bar and from the Search bar's tune icon. Rides the shared
// LocalSheet (portals into the app card, animated open/close, ESC) with
// keepMounted so selections survive a close. Frontend-only for now — see
// DiscoveryFilters for the wiring status.

export function FilterSheet({
  open,
  onClose,
  ariaLabel = "Discovery filters",
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
}) {
  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel={ariaLabel}
      keepMounted
    >
      <DiscoveryFilters onClose={onClose} />
    </LocalSheet>
  );
}

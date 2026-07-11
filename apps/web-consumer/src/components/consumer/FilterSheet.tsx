"use client";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { FiltersComingSoon } from "@/components/consumer/FiltersComingSoon";

// Discovery filters for the Home Swipe deck — PARKED (soon). The trigger still
// opens this sheet, but it now shows a single coming-soon state instead of the
// What / Where / When band while we finish the real filtering backend. The
// full What/Where/When implementation lives in this file's git history — to
// un-park, restore that body and drop FiltersComingSoon. Rides the shared
// LocalSheet (portals into the app card, animated open/close, ESC).

export function FilterSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Discovery filters">
      <FiltersComingSoon onClose={onClose} />
    </LocalSheet>
  );
}

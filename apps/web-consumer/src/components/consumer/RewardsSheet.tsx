"use client";

import { PlaceTopBar, VouchersPane, type PlaceActions, type RewardsSection } from "@mesita/place-profile";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import type { PlaceDetail } from "@/lib/place-detail";

// THE REWARDS SHEET (Pato, MESITA-3412: "Rewards modal opens when you click
// either prepay or pay, but covering almost full screen"): the place's
// Rewards page, once the fourth tab, in the house semi-modal (88%, the same
// shape as Contact, Reserve and Upgrade). Prepay opens it at Pre-Payment
// Rewards, Pay at Payment Rewards. The pane undoes a 16px body inset, so the
// scroller supplies it.
export function RewardsSheet({
  place,
  actions,
  section,
  onClose,
}: {
  place: PlaceDetail;
  actions: PlaceActions;
  /** The section to open at; null = closed. */
  section: RewardsSection | null;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={section != null} onClose={onClose} ariaLabel={`${place.name} offers`} fullScreen from="right">
      <PlaceTopBar
        name={place.name}
        premierTier={place.boost_tier ?? 0}
        mesitaPay={place.money?.mesita_pay === true}
        onBack={onClose}
        onMore={actions.onMore}
      />
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        {section != null ? <VouchersPane place={place} actions={actions} focus={section} /> : null}
      </div>
    </LocalSheet>
  );
}

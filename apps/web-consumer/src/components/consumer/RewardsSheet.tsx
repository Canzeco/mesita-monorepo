"use client";

import { useState } from "react";
import { OffersWalletPill, PlaceTopBar, VouchersPane, type PlaceActions, type RewardsSection } from "@mesita/place-profile";
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
  // THE SAME SLIDE BOTH WAYS (MESITA-3473, Pato: "the animation from profile
  // to offers must be the same one as the one from offers to profile"): the
  // last section stays drawn while the page slides back out, so it leaves
  // with its content instead of as a blank panel. Set during render, the
  // prop-to-state pattern React documents; never in an effect.
  const [last, setLast] = useState<RewardsSection | null>(section);
  if (section != null && section !== last) setLast(section);
  const drawn = section ?? last;
  return (
    <LocalSheet open={section != null} onClose={onClose} ariaLabel={`${place.name} offers`} fullScreen from="right">
      {/* A hairline between the bar and the page (MESITA-3474, Pato: "add a
          line dividing ... only the header from the body"). */}
      <div className="border-border border-b">
      <PlaceTopBar
        name={place.name}
        premierTier={place.boost_tier ?? 0}
        onBack={onClose}
        right={<OffersWalletPill place={place} />}
      />
      </div>
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        {drawn != null ? <VouchersPane place={place} actions={actions} focus={drawn} /> : null}
      </div>
    </LocalSheet>
  );
}

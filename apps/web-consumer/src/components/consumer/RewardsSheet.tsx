"use client";

import { useState } from "react";
import { PlaceTopBar, VouchersPane, type PlaceActions, type RewardsSection } from "@mesita/place-profile";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import type { WalletCardModel } from "@/components/consumer/wallet/WalletCard";
import { CreditsRow } from "@/components/consumer/wallet/WalletLists";
import type { PlaceDetail } from "@/lib/place-detail";

/** The place's balance as a Wallet card: the server's amounts, formatted
 *  by the row, never added. No balance read = $0. */
function offersCard(place: PlaceDetail): WalletCardModel {
  const balance = place.money?.balance ?? null;
  return {
    key: place.id,
    name: place.name,
    photo: place.profilePhoto ?? null,
    tier: place.boost_tier ?? null,
    currency: place.money?.currency ?? "mxn",
    available_cents: balance?.available_cents ?? 0,
    pending_cents: balance?.pending_cents ?? 0,
    hasBalance: balance !== null,
    tap: { kind: "plain" },
  };
}

// THE REWARDS SHEET (Pato, MESITA-3412: "Rewards modal opens when you click
// either prepay or pay, but covering almost full screen"): the place's
// Rewards page, once the fourth tab, in the house semi-modal (88%, the same
// shape as Contact, Reserve and Upgrade). Prepay opens it; since MESITA-4062
// it holds the Prepayments card only. The pane undoes a 16px body inset, so
// the scroller supplies it.
export function RewardsSheet({
  place,
  actions,
  section,
  onClose,
}: {
  place: PlaceDetail;
  actions: PlaceActions;
  /** Why it opened; null = closed. */
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
      />
      </div>
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        {/* THE BALANCE, ABOVE THE OFFERS (Pato, 2026-11-15, MESITA-4060:
            "remove that wallet of there because it looks like a button. just
            at the top of products maybe display the current balance ...
            reusing the component of wallet"): the Wallet's own Credits row,
            in one box, no link (this page is the place's). It replaced the
            top bar's black balance pill (OffersWalletPill, MESITA-3483..3935).
            The pane pulls itself up 16px, so its wrapper gives that back. */}
        <div className="border-border bg-card shrink-0 overflow-hidden rounded-2xl border" data-offers-balance>
          <CreditsRow card={offersCard(place)} />
        </div>
        <div className="flex flex-1 shrink-0 flex-col pt-4">
          {drawn != null ? <VouchersPane place={place} actions={actions} /> : null}
        </div>
      </div>
    </LocalSheet>
  );
}

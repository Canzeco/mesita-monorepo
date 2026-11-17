"use client";

import { useState } from "react";
import { ChevronLeft, Wallet } from "lucide-react";
import { VouchersPane, type PlaceActions, type RewardsSection } from "@mesita/place-profile";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { money } from "@/lib/api/wallet";
import { cardAmount } from "@/lib/wallet-card";
import type { PlaceDetail } from "@/lib/place-detail";

/** The guest's credit here as one number (MESITA-4173): the Wallet card's
 *  own amount, the server's cents, formatted and never added. No balance
 *  read = $0. */
function creditHere(place: PlaceDetail): { label: string; amount: string } {
  const balance = place.money?.balance;
  const currency = place.money?.currency ?? "mxn";
  const shown = cardAmount({ available_cents: balance?.available_cents ?? 0, pending_cents: balance?.pending_cents ?? 0 });
  return { label: shown.pending ? "Pending credit here" : "Your credit here", amount: money(shown.cents, currency) };
}

// THE REWARDS SHEET (Pato, MESITA-3412: "Rewards modal opens when you click
// either prepay or pay, but covering almost full screen"): the place's
// Rewards page, once the fourth tab, in the house semi-modal (88%, the same
// shape as Contact, Reserve and Upgrade). Every Offers tap opens it since
// MESITA-4173; Special Offers, then Classic Offers since MESITA-4218. The pane undoes a 16px
// body inset, so the scroller supplies it.
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
  const credit = creditHere(place);
  return (
    <LocalSheet open={section != null} onClose={onClose} ariaLabel={`${place.name} offers`} fullScreen from="right">
      {/* THE PAGE IS "OFFERS" (Pato, MESITA-4173: "the page must not be called
          prepay, it must be called Offers. so at the top the name of the
          place"): the title over the place's name; a hairline under the bar
          (MESITA-3474). The place's top bar with its name alone before. */}
      <header className="bg-card border-border z-20 flex h-14 shrink-0 items-center gap-1 border-b px-1.5">
        <button
          type="button"
          aria-label="Back"
          onClick={onClose}
          className="text-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-lg leading-tight font-bold">Offers</h2>
          <p className="text-muted-foreground truncate text-[0.8125rem] leading-tight">{place.name}</p>
        </div>
      </header>
      {/* The grey page under the panels (MESITA-4196), as the Reserve page. */}
      <div className="scrollbar-thin-dark bg-background flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        {/* THE CREDIT AS ONE NUMBER (Pato, MESITA-4173: "it must display
            current wallet just the number with current amount"): a black
            card, the label over the amount. The Wallet's Credits row before
            (MESITA-4060), the top bar's black pill before that. */}
        <div
          className="bg-foreground text-paper flex shrink-0 items-center justify-between gap-3 rounded-2xl px-4 py-3"
          aria-label={`${credit.label}: ${credit.amount}`}
          data-offers-balance
        >
          {/* ONE LINE (MESITA-4221: "shorter … i don't want to scroll"): the
              label and wallet at the left, the amount at the right. */}
          <p className="flex min-w-0 items-center gap-2 text-[0.6875rem] font-bold tracking-wider uppercase opacity-80" aria-hidden>
            <Wallet className="h-5 w-5 shrink-0" strokeWidth={2.25} />
            <span className="truncate">{credit.label}</span>
          </p>
          <p className="shrink-0 text-2xl leading-none font-extrabold tracking-tight tabular-nums" aria-hidden>{credit.amount}</p>
        </div>
        <div className="flex flex-1 shrink-0 flex-col pt-3">
          {drawn != null ? <VouchersPane key={actions?.askedVoucher ?? "none"} place={place} actions={actions} /> : null}
        </div>
      </div>
    </LocalSheet>
  );
}

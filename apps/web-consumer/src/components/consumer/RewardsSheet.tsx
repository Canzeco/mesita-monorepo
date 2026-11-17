"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Wallet } from "lucide-react";
import { readyClock, VouchersPane, type PlaceActions, type RewardsSection } from "@mesita/place-profile";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { money } from "@/lib/api/wallet";
import { walletPlacePath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import type { PlaceDetail } from "@/lib/place-detail";

/** The guest's credit here (MESITA-4224): spendable now, and the pending
 *  part with the time the next of it turns on. The server's cents,
 *  formatted, never added. Null when no balance was read (signed out). */
function creditHere(place: PlaceDetail): { label: string; ready: string; pending: string | null } | null {
  const balance = place.money?.balance;
  if (!balance) return null;
  const currency = place.money?.currency ?? "mxn";
  const ready = money(balance.spendable_cents, currency);
  const at = balance.next_ready_at ? readyClock(balance.next_ready_at) : "";
  const pending = balance.pending_cents > 0
    ? `Pending ${money(balance.pending_cents, currency)}${at ? ` · ready ${at}` : ""}`
    : null;
  return { label: `Ready now ${ready}${pending ? `. ${pending}` : ""}`, ready, pending };
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
  const router = useRouter();
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
        {/* ONE LINE (Pato, 2026-11-17, MESITA-4224: "the header must only
            have one line ... the place name and profile picture"): the
            place's round photo and its name. "Offers" over the name before. */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
          {place.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.profilePhoto} alt="" className="bg-muted h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : null}
          <h2 className="text-foreground truncate text-base leading-tight font-semibold">{place.name}</h2>
        </div>
      </header>
      {/* The grey page under the panels (MESITA-4196), as the Reserve page. */}
      <div className="scrollbar-thin-dark bg-background flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        {/* READY NOW, PENDING AND WHEN (Pato, 2026-11-17, MESITA-4224:
            "current balance pending balance (for the bonuses)", D3): the big
            number is what the guest can spend here now; the line under it,
            only while a bonus waits, says how much and when. Signed out there
            is no balance and no card (D6). */}
        {credit ? (
          // TWO WAYS ON (Pato, 2026-11-17, MESITA-4230: "add shortcut to go
          // for wallet or shortcut to go to pay bill"; D5): the card opens
          // your credit here (history, pending); its white Pay bill opens
          // this place's Pay, where the credit spends.
          <div className="bg-foreground text-paper relative flex shrink-0 flex-col gap-2 rounded-2xl px-4 py-3" data-offers-balance>
            <button
              type="button"
              onClick={() => navigateTo(router, walletPlacePath(place.id), { motion: "drill" })}
              aria-label={`Your credit here. ${credit.label}`}
              className="absolute inset-0 rounded-2xl"
              data-offers-credit-link
            />
            <div className="pointer-events-none flex items-center justify-between gap-3" aria-hidden>
              <p className="flex min-w-0 items-center gap-2 text-[0.6875rem] font-bold tracking-wider uppercase opacity-80">
                <Wallet className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                <span className="truncate">Ready now</span>
              </p>
              <p className="shrink-0 text-2xl leading-none font-extrabold tracking-tight tabular-nums">{credit.ready}</p>
            </div>
            <div className="pointer-events-none flex items-center justify-between gap-3">
              {credit.pending ? (
                <p className="flex min-w-0 items-center gap-1.5 text-sm tabular-nums opacity-80" aria-hidden data-offers-pending>
                  <Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  <span className="truncate">{credit.pending}</span>
                </p>
              ) : (
                <span className="flex items-center gap-0.5 text-sm opacity-80" aria-hidden>
                  Your credit here <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
              )}
              {actions.onPay ? (
                <button
                  type="button"
                  onClick={actions.onPay}
                  className="bg-paper text-foreground pointer-events-auto relative h-9 shrink-0 rounded-full px-4 text-sm font-bold hover:opacity-90"
                  data-offers-pay-bill
                >
                  Pay bill
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={credit ? "flex flex-1 shrink-0 flex-col pt-3" : "flex flex-1 shrink-0 flex-col"}>
          {drawn != null ? <VouchersPane key={actions?.askedVoucher ?? "none"} place={place} actions={actions} /> : null}
        </div>
      </div>
    </LocalSheet>
  );
}

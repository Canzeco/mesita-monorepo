"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, QrCode, Wallet } from "lucide-react";
import { readyClock, VouchersPane, type PlaceActions, type RewardsSection } from "@mesita/place-profile";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { money } from "@/lib/api/wallet";
import { PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
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
          // TWO BLACK BUTTONS (Pato, 2026-11-18, MESITA-4320: "i don't like
          // the current format of the card ... two horizontal buttons. Pay
          // Here. see Card. but two separated buttons. Both black. use the
          // standard size"): no card. The balance is one plain line, then
          // Pay here (this place's Pay, where the credit spends) and See
          // card (your credit here: history, pending) side by side at the
          // app's 48px. Before: a black card the whole of which opened your
          // credit, with a white Pay bill pill (MESITA-4230).
          <div className="flex shrink-0 flex-col gap-3" data-offers-balance>
            <div className="flex items-baseline justify-between gap-3 px-1">
              <p className="text-muted-foreground text-sm font-medium">Ready now</p>
              <p className="text-foreground text-2xl leading-none font-extrabold tracking-tight tabular-nums">{credit.ready}</p>
            </div>
            {credit.pending ? (
              <p className="text-muted-foreground -mt-1 flex items-center gap-1.5 px-1 text-sm tabular-nums" data-offers-pending>
                <Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="truncate">{credit.pending}</span>
              </p>
            ) : null}
            <div className="flex gap-3">
              {actions.onPay ? (
                <button
                  type="button"
                  onClick={actions.onPay}
                  className={cn(PRIMARY_BUTTON_CLASS, "flex-1")}
                  data-offers-pay-bill
                >
                  <QrCode className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  Pay here
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navigateTo(router, walletPlacePath(place.id), { motion: "drill" })}
                aria-label={`See card. ${credit.label}`}
                className={cn(PRIMARY_BUTTON_CLASS, "flex-1")}
                data-offers-credit-link
              >
                <Wallet className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                See card
              </button>
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

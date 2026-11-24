"use client";

// WALLET'S PICKER (Prepay's is the Wallet's own tile since MESITA-4838). It was two (MESITA-4096, Pato, 2026-11-15: "buy credits and send
// credits must actually display a list of places to select the action ... so
// its like shortcut instead of going to the card subpage"). Each is a pushed
// page with Back to Wallet, never a sheet (his same-day rule: "use subpages
// with own routes").
//
//   /wallet/buy    the places with offers (consumer-web-list-pay-places,
//                  `offers_ok`). A row opens the place's Offers, where the
//                  buying happens (MESITA-3883).
//   /wallet/send   the Wallet's Loyalty Cards. A row opens that card's send page,
//                  /wallet/place/<id>/send, which offers Buy Credits when
//                  there is not enough to send.
//
// The rows are the Wallet's own Credits rows (CreditsRow): the place's photo
// and name, the balance pill. Both lists end with the Wallet's "Add a Credits
// Card" row, which opens the same explainer (MESITA-4115, Pato: "at the
// bottom of both the list of Buy Credits and Send Gift, add the add a Credits
// Card option, and when clicked display the modal explaining how").

/** The last row of both pickers, and the explainer it opens. */
function AddCreditsCardRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AddRow line="Add a Loyalty Card" ariaLabel="Add a Loyalty Card" onClick={() => setOpen(true)} />
      <AddCreditsCardDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

import { type ReactNode, useState } from "react";
import { Gift } from "lucide-react";

import { Screen } from "@/components/consumer/nav/Screen";
import { payTabPath } from "@/components/consumer/pay/pay-sections";
import { EmptyState } from "@/components/shared/EmptyState";
import { walletSendPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { useWallet } from "./use-wallet";
import { AddCreditsCardDialog } from "./AddCreditsCardDialog";
import { AddRow, CreditsRow, RowsSkeleton } from "./WalletLists";

/** A place's prepay page from the Prepay picker: its Offers at Prepayments.
 *  A paid offer ends on the Loyalty Card, which replaces Offers (MESITA-4601). */
export function prepayHref(placeIdOrSlug: string): string {
  return `${placeHref(placeIdOrSlug)}/offers?rewards=prepayment`;
}

/** The same page from a screen the guest must come back to (Send Gift's Buy
 *  Credits): `from=wallet`, so a paid offer pops back to that screen. */
export function prepayReturnHref(placeIdOrSlug: string): string {
  return `${prepayHref(placeIdOrSlug)}&from=wallet`;
}

/** /wallet/send — pick the Loyalty Card to send credit from. */
export function SendGiftPage() {
  const { wallet, credits, failed, reread } = useWallet();
  // CLEANER (Pato, 2026-11-23, MESITA-4760: "this must be cleaner, like
  // select a card"): the banner says the task, then the cards edge to edge,
  // hairlines between, like Prepay's list. No "Your places" box. Empty and
  // error states keep their 20px inset. The banner itself is MESITA-4755's.
  const flushList = (rows: ReactNode[]) => (
    <ul role="list" className="divide-border border-border divide-y border-b" data-send-gift-cards>
      {rows.map((row, i) => (
        <li key={i}>{row}</li>
      ))}
    </ul>
  );
  return (
    <Screen title="Send Gift" paper flush>
      <p role="note" className="flex shrink-0 items-center gap-2.5 bg-neutral-950 px-4 py-2.5 text-base font-semibold text-white" data-list-banner>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-neutral-950" aria-hidden>
          <Gift className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <span className="min-w-0">Choose a card to send from</span>
      </p>
      {credits === null && failed ? (
        <div className="px-5 py-5">
          <EmptyState
            icon={Gift}
            title="Couldn't load your Wallet"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: reread }}
          />
        </div>
      ) : credits === null ? (
        flushList([
          <RowsSkeleton key="bones" count={3} />,
          <AddRow key="add" line="Add a Loyalty Card" ariaLabel="Add a Loyalty Card" disabled />,
        ])
      ) : wallet?.can_send !== true ? (
        <div className="px-5 py-5">
          <EmptyState icon={Gift} title="Sending credit isn't open yet" />
        </div>
      ) : credits.length === 0 ? (
        <div className="px-5 py-5">
          <EmptyState
            icon={Gift}
            title="No Loyalty Cards yet"
            description="Buy credits at a place first."
            action={{ label: "Buy Credits", href: payTabPath("prepay") }}
          />
        </div>
      ) : (
        flushList([
          ...credits.map((r, i) => (
            <CreditsRow
              key={r.placeId}
              card={r.card}
              gone={r.balance.place === null}
              href={walletSendPath(r.placeId)}
              eager={i < 4}
            />
          )),
          <AddCreditsCardRow key="add" />,
        ])
      )}
    </Screen>
  );
}

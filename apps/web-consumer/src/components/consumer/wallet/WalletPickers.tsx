"use client";

// WALLET'S TWO PICKERS (MESITA-4096, Pato, 2026-11-15: "buy credits and send
// credits must actually display a list of places to select the action ... so
// its like shortcut instead of going to the card subpage"). Each is a pushed
// page with Back to Wallet, never a sheet (his same-day rule: "use subpages
// with own routes").
//
//   /wallet/buy    the places that sell credits: Mesita Payments places that
//                  take cards (consumer-web-list-pay-places, `card_ok`). A row
//                  opens the place's Offers at Prepayments, where the buying
//                  happens (MESITA-3883).
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

import { useState } from "react";
import { Gift } from "lucide-react";

import { Screen } from "@/components/consumer/nav/Screen";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/lib/navigate";
import { PlacePickBody } from "@/components/consumer/pay/PayPick";
import { EmptyState } from "@/components/shared/EmptyState";
import { CONSUMER_ROUTES, walletSendPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { useWallet } from "./use-wallet";
import { AddCreditsCardDialog } from "./AddCreditsCardDialog";
import { AddRow, CreditsRow, RowsSkeleton, WalletPanelList } from "./WalletLists";

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

/** /wallet/buy — Prepay & Get Credits (MESITA-4597, Pato: "first of all
 *  Prepay & Get Credits. NO MARGINS … searchbar at the top and then just
 *  display first the 3 closest places. then … the loyalty cards you already
 *  have"): the Pay Bill picker's body in prepay mode, edge to edge, no box,
 *  no balance, no Add row; a place opens its Offers at Prepayments, where the
 *  buying happens. A bordered "Places" list with balances and an Add row
 *  before. */
export function BuyCreditsPage() {
  const router = useRouter();
  return (
    // EXPLORE DISCOUNTS (MESITA-4698): the places with offers; a row opens
    // its Offers page, which picks Cashbacks or Vouchers itself.
    <Screen title="Get Offers" paper flush>
      <div className="flex min-h-0 flex-1 flex-col pt-3 pb-8">
        <PlacePickBody prepay onPick={(id) => navigateTo(router, `${placeHref(id)}/offers`, { motion: "drill" })} />
      </div>
    </Screen>
  );
}

/** /wallet/send — pick the Loyalty Card to send credit from. */
export function SendGiftPage() {
  const { wallet, credits, failed, reread } = useWallet();
  return (
    <Screen title="Send Gift" paper>
      {credits === null && failed ? (
        <EmptyState
          icon={Gift}
          title="Couldn't load your Wallet"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: reread }}
        />
      ) : credits === null ? (
        <WalletPanelList title="Your places">
          <RowsSkeleton count={3} />
          <AddRow line="Add a Loyalty Card" ariaLabel="Add a Loyalty Card" disabled />
        </WalletPanelList>
      ) : wallet?.can_send !== true ? (
        <EmptyState icon={Gift} title="Sending credit isn't open yet" />
      ) : credits.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No Loyalty Cards yet"
          description="Buy credits at a place first."
          action={{ label: "Buy Credits", href: CONSUMER_ROUTES.walletBuy }}
        />
      ) : (
        <WalletPanelList title="Your places">
          {credits.map((r, i) => (
            <CreditsRow
              key={r.placeId}
              card={r.card}
              gone={r.balance.place === null}
              href={walletSendPath(r.placeId)}
              eager={i < 4}
            />
          ))}
          <AddCreditsCardRow />
        </WalletPanelList>
      )}
    </Screen>
  );
}

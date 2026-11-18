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
import { Gift, Store } from "lucide-react";

import { Screen } from "@/components/consumer/nav/Screen";
import { EmptyState } from "@/components/shared/EmptyState";
import type { PayPlace } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, walletSendPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { usePayPlaces } from "@/components/consumer/pay/use-pay-places";
import { useWallet } from "./use-wallet";
import { AddCreditsCardDialog } from "./AddCreditsCardDialog";
import { AddRow, CreditsRow, RowsSkeleton, WalletPanelList } from "./WalletLists";
import type { WalletCardModel } from "./WalletCard";

/** A place's prepay page: its Offers at Prepayments, Back returning here. */
export function prepayHref(placeIdOrSlug: string): string {
  return `${placeHref(placeIdOrSlug)}/offers?rewards=prepayment&from=wallet`;
}

function payPlaceCard(p: PayPlace): WalletCardModel {
  return {
    key: `${p.place_id}:${p.currency}`,
    name: p.name ?? "A Mesita place",
    photo: p.photo,
    tier: p.marks.tier,
    currency: p.currency,
    available_cents: p.available_cents,
    pending_cents: p.pending_cents,
    hasBalance: p.available_cents > 0 || p.pending_cents > 0,
    tap: { kind: "plain" },
  };
}

/** /wallet/buy — pick the place to buy credits from. */
export function BuyCreditsPage() {
  const { places, failed, refresh } = usePayPlaces(null);
  const selling = places?.filter((p) => p.card_ok) ?? null;
  return (
    <Screen title="Buy Credits" paper>
      {selling === null && failed ? (
        <EmptyState
          icon={Store}
          title="Couldn't load the places"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: refresh }}
        />
      ) : selling === null ? (
        <WalletPanelList title="Places">
          <RowsSkeleton count={3} />
          <AddRow line="Add a Loyalty Card" ariaLabel="Add a Loyalty Card" disabled />
        </WalletPanelList>
      ) : selling.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No place sells credits yet"
          action={{ label: "Find a place", href: CONSUMER_ROUTES.search }}
        />
      ) : (
        <WalletPanelList title="Places">
          {selling.map((p, i) => (
            <CreditsRow key={p.place_id} card={payPlaceCard(p)} href={prepayHref(p.place_id)} eager={i < 4} />
          ))}
          <AddCreditsCardRow />
        </WalletPanelList>
      )}
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

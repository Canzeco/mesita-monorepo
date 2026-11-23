"use client";

// WALLET'S TWO PICKERS (MESITA-4096, Pato, 2026-11-15: "buy credits and send
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

import { useState } from "react";
import { BadgePercent, Gift, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListLocationBox } from "./ListLocationBox";

import { Screen } from "@/components/consumer/nav/Screen";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/lib/navigate";
import { PlacePickBody } from "@/components/consumer/pay/PayPick";
import { EmptyState } from "@/components/shared/EmptyState";
import { CONSUMER_ROUTES, placeOffersPath, walletSendPath } from "@/lib/consumer-route-contract";
import { payPlaceTabs, type PayPlace } from "@/lib/api/wallet";
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
export function BuyCreditsPage({ offers = "any" }: { offers?: "vouchers" | "any" }) {
  const router = useRouter();
  // TWO DOORS, ONE LIST (MESITA-4731, D5): Pay's Prepay opens it as
  // `?offers=vouchers` (places that sell a voucher, landing on their Prepay
  // tab); Explore Offers as `?offers=any` (places with any offer, landing on
  // their first: Prepay, else Pay, else Post).
  const open = (id: string, p?: PayPlace) => {
    const t = p ? payPlaceTabs(p) : null;
    const tab = offers === "vouchers" || !t || t.prepay ? "prepayment" : t.pay ? "cashback" : t.post ? "post" : null;
    navigateTo(router, placeOffersPath(id, tab), { motion: "drill" });
  };
  const vouchers = offers === "vouchers";
  return (
    <Screen title={vouchers ? "Prepay" : "Explore Offers"} paper flush action={<ListLocationBox title={vouchers ? "short" : "long"} />}>
      {/* A BANNER THAT SAYS WHAT THIS IS (Pato, 2026-11-23, MESITA-4748:
          "between header and searchbar add banner … like prepay and get
          bonus … really short text"; /plan-design-review D6): one line, full
          bleed. Prepay's is Link green, the Wallet tile's colour; Explore
          Offers' is grey with the tag in a green disc. */}
      <p
        role="note"
        className={cn(
          "flex shrink-0 items-center gap-2.5 px-4 py-2.5 text-base font-semibold",
          vouchers ? "bg-[#00D66F] text-neutral-950" : "bg-muted text-foreground border-border border-b",
        )}
        data-list-banner
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            vouchers ? "bg-neutral-950 text-white" : "bg-[#00D66F] text-neutral-950",
          )}
          aria-hidden
        >
          {vouchers ? <BadgePercent className="h-4 w-4" strokeWidth={2.5} /> : <Tag className="h-4 w-4" strokeWidth={2.5} />}
        </span>
        <span className="min-w-0">{vouchers ? "Prepay and get bonus credit" : "Prepay, pay or post and earn credit"}</span>
      </p>
      <div className="flex min-h-0 flex-1 flex-col pb-8">
        <PlacePickBody prepay offers={offers} onPick={open} />
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

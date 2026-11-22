"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  OFFER_TICKET_STEPS,
  OfferTicket,
  type MoneyVoucherKey,
  type OfferTicketFrame,
  type PlaceActions,
} from "@mesita/place-profile";
import { usePlaceVouchers } from "@/components/consumer/member-place-actions";
import { StepBody, StepFooter, TicketHeader } from "@/components/consumer/pay/pay-flow";
import {
  CONSUMER_ROUTES,
  payPlacePath,
  placeOffersPath,
  placeStoryPath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import type { PlaceDetail } from "@/lib/place-detail";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { storyRulesOf } from "@/lib/consumer-identity";

function noopSubscribe() {
  return () => {};
}

/** Offers' own `from` (MESITA-4599/4601), copied onto the ticket by the row
 *  tap: where a paid ticket's Done returns. */
function readFrom(): "pay" | "wallet" | null {
  const f = new URLSearchParams(window.location.search).get("from");
  return f === "pay" || f === "wallet" ? f : null;
}

// THE VOUCHER TICKET'S PAGE (MESITA-4630): the package's OfferTicket in Pay
// Bill's frame (pay-flow.tsx), the question at the left of the header, ✕ at
// the right, the steps at the bottom over the one dark button.
//
//   ✕ before the charge  → back to Offers (keeping `from`)
//   Done / ✕ after it    → from=pay: back to the bill · from=wallet: back to
//                          the Loyalty Card · neither: the Loyalty Card
//                          replaces the ticket (MESITA-4055)
//   Story                → its own page (MESITA-4303)
//   unknown / not offered→ Offers
//
// Only the guest's saved card pays (Pato: "ONLY INCLUDE THE SAVED PAYMENT
// METHOD IN WALLET"); no card opens Add a card, a modal, over the Pay step.
export function OfferTicketBody({ place: fetched, voucher }: { place: PlaceDetail; voucher: string }) {
  const router = useRouter();
  const profile = useConsumerProfile().data;
  const from = useSyncExternalStore(noopSubscribe, readFrom, () => null);
  const vouchers = usePlaceVouchers(fetched.id);
  const loadCards = vouchers.loadCards;
  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const offersHref = placeOffersPath(fetched.id, "prepayment", from === "wallet");
  const offersWithFrom = from === "pay" ? `${offersHref}${offersHref.includes("?") ? "&" : "?"}from=pay` : offersHref;
  const leave = useCallback(() => goBack(router, offersWithFrom), [router, offersWithFrom]);
  const finish = useCallback(() => {
    if (from === "pay") goBack(router, payPlacePath(fetched.id));
    else if (from === "wallet") goBack(router, walletPlacePath(fetched.id));
    else navigateTo(router, walletPlacePath(fetched.id), { replace: true, motion: "push" });
  }, [router, from, fetched.id]);
  const missing = useCallback(() => {
    if (voucher === "voucher_story") navigateTo(router, placeStoryPath(fetched.id), { replace: true });
    else navigateTo(router, offersWithFrom, { replace: true });
  }, [router, voucher, fetched.id, offersWithFrom]);

  const place: PlaceDetail = vouchers.money ? { ...fetched, money: vouchers.money } : fetched;
  const actions: PlaceActions = {
    onBuyVoucher: vouchers.buy,
    onOfferOpened: vouchers.opened,
    buyingVoucher: vouchers.buying,
    ...(vouchers.payCards ? { payCards: vouchers.payCards } : {}),
    payCardId: vouchers.payCardId,
    onSelectPayCard: vouchers.selectCard,
    // Add a card is a modal (MESITA-4398): the ticket stays on Pay and the
    // new card becomes the selected one.
    onAddPayCard: () => vouchers.addCard(),
    onRetryPayCards: () => void vouchers.loadCards(),
    onLoadVouchers: vouchers.load,
    vouchersLoading: vouchers.loading,
    ...(profile
      ? {
        guest: {
          instagramLinked: Boolean(profile.instagram_handle),
          instagramFollowers: profile.instagram_followers_count ?? null,
          instagramHandle: profile.instagram_handle ?? null,
          storyMinFollowers: storyRulesOf(profile).minFollowers,
          storyEmulator: storyRulesOf(profile).emulator,
        },
      }
      : {}),
    onLinkInstagram: () => navigateTo(router, CONSUMER_ROUTES.mePages.instagram, { motion: "drill" }),
  };

  const frame = (f: OfferTicketFrame) => (
    <>
      <TicketHeader
        title={f.title}
        onBack={f.onBack ?? undefined}
        onClose={f.busy ? undefined : f.paid ? finish : leave}
        closeLabel={f.paid ? "Done" : "Close"}
      />
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" data-offer-ticket={f.step}>
        <StepBody className="text-left">{f.body}</StepBody>
        <StepFooter strip={f.allDone ? "done" : f.step} steps={OFFER_TICKET_STEPS} primary={f.primary ?? undefined} />
      </div>
    </>
  );

  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col" data-offer-ticket-route>
      <OfferTicket
        place={place}
        actions={actions}
        productKey={voucher as MoneyVoucherKey}
        frame={frame}
        onFinish={finish}
        onMissing={missing}
      />
    </div>
  );
}

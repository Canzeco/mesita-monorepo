"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { StoryOfferPage, type PlaceActions } from "@mesita/place-profile";
import { ScreenHeader } from "@/components/consumer/nav/Screen";
import { usePlaceVouchers } from "@/components/consumer/member-place-actions";
import { CONSUMER_ROUTES, placeOffersPath, walletPlacePath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import type { PlaceDetail } from "@/lib/place-detail";
import { useConsumerProfile } from "@/lib/use-consumer-profile";

/**
 * THE STORY PAGE (MESITA-4303): the Story offer in boxes with its action
 * pinned under them (packages/place-profile StoryOfferPage). The same reads
 * as the Offers page (usePlaceVouchers), but a paid Story stays here as its
 * countdown (D4) instead of leaving for Wallet. Back returns to Offers, the
 * page that pushed it (/place/<id>/offers since MESITA-4379).
 */
export function StoryPageBody({ place: fetched }: { place: PlaceDetail }) {
  const router = useRouter();
  const profile = useConsumerProfile().data;
  const vouchers = usePlaceVouchers(fetched.id);
  const loadCards = vouchers.loadCards;
  useEffect(() => {
    void loadCards();
  }, [loadCards]);
  const offersHref = placeOffersPath(fetched.id, "special");
  const back = useCallback(() => goBack(router, offersHref), [router, offersHref]);
  const place: PlaceDetail = vouchers.money ? { ...fetched, money: vouchers.money } : fetched;

  const actions: PlaceActions = {
    onBuyVoucher: vouchers.buy,
    onOfferOpened: vouchers.opened,
    onCheckStory: vouchers.checkStory,
    onSimulateStory: vouchers.simulateStory,
    onSimulateApproval: vouchers.simulateApproval,
    // MESITA-4304: the waiter scans this to approve the story before Pay.
    renderStoryQr: (url: string) => <QRCodeSVG value={url} size={224} marginSize={0} aria-label="Story QR for the waiter" />,
    buyingVoucher: vouchers.buying,
    ...(vouchers.payCards ? { payCards: vouchers.payCards } : {}),
    payCardId: vouchers.payCardId,
    onSelectPayCard: vouchers.selectCard,
    // The Add a card page comes back to this address, so to this page.
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
        },
      }
      : {}),
    onLinkInstagram: () => navigateTo(router, CONSUMER_ROUTES.mePages.instagram, { motion: "drill" }),
  };

  return (
    <div className="bg-background flex flex-1 flex-col overflow-hidden" data-story-route>
      <ScreenHeader title="Story" onBack={back} />
      <StoryOfferPage
        place={place}
        actions={actions}
        onDone={back}
        onWallet={() => navigateTo(router, walletPlacePath(fetched.id), { motion: "drill" })}
      />
    </div>
  );
}

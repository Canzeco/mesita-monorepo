"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StoryOfferPage, type PlaceActions } from "@mesita/place-profile";
import { ScreenHeader } from "@/components/consumer/nav/Screen";
import { usePlaceVouchers } from "@/components/consumer/member-place-actions";
import { CONSUMER_ROUTES, placeOffersPath } from "@/lib/consumer-route-contract";
import { ticketsHref } from "@/lib/ticket-kinds";
import { goBack, navigateTo } from "@/lib/navigate";
import type { PlaceDetail } from "@/lib/place-detail";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { storyRulesOf } from "@/lib/consumer-identity";

/**
 * THE STORY PAGE (MESITA-4303): the Story offer in boxes with its action
 * pinned under them (packages/place-profile StoryOfferPage). The same reads
 * as the Offers page (usePlaceVouchers). Buy only since MESITA-4405: a paid
 * Story lands on its own screen (Me › Tickets › Stories, usePlaceVouchers'
 * buy). Back returns to Offers, the page that pushed it.
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
          storyMinFollowers: storyRulesOf(profile).minFollowers,
          storyEmulator: storyRulesOf(profile).emulator,
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
        onWallet={() => navigateTo(router, ticketsHref("stories"), { motion: "drill" })}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { OFFER_TICKET_KEYS, readyClock, VouchersPane, type PlaceActions } from "@mesita/place-profile";
import { usePlaceVouchers } from "@/components/consumer/member-place-actions";
import { money } from "@/lib/api/wallet";
import {
  CONSUMER_ROUTES,
  placeOfferPath,
  placePath,
  placeStoryPath,
  payPlacePath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { useKeptScroll } from "@/lib/use-kept-scroll";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import type { PlaceDetail } from "@/lib/place-detail";
import { storyRulesOf } from "@/lib/consumer-identity";

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

function noopSubscribe() {
  return () => {};
}

/** `from=wallet` (MESITA-3883, MESITA-4601): Offers was opened by a wallet
 *  screen that wants the guest back (a Loyalty Card's Offers tile, Send
 *  Gift's Buy Credits). A paid offer pops to that screen instead of
 *  replacing Offers with the card, and a cold-open Back falls to the card.
 *  No forward control reads it. */
function readFromWallet(): boolean {
  return new URLSearchParams(window.location.search).get("from") === "wallet";
}

/** Opened from Pay Bill's prepay offer (MESITA-4599): paid or Back, the bill. */
function readFromPay(): boolean {
  return new URLSearchParams(window.location.search).get("from") === "pay";
}

/** An old `?voucher=` (the Add a card round trip, MESITA-4230; Home chips
 *  before MESITA-4455): it now opens that voucher's ticket (MESITA-4630). */
function readVoucherAsk(): string | null {
  return new URLSearchParams(window.location.search).get("voucher");
}

// THE OFFERS PAGE (MESITA-4379, Pato: "when i click to see a profile, why the
// fuck are you showing me that … why it needs to pass across that page"):
// Offers was a full-screen sheet over the place profile at
// /place/<id>?rewards=…, so every Offers tap loaded the profile first and
// slid the sheet in over it. Now it is the place's own page, like Reserve
// and Story: it slides in over whatever it was opened from, and Back
// uncovers that screen. The reads are the place's vouchers and the guest's
// saved cards (usePlaceVouchers), the same the Story page uses.
export function OffersPageBody({ place: fetched }: { place: PlaceDetail }) {
  const router = useRouter();
  const profile = useConsumerProfile().data;
  const fromWallet = useSyncExternalStore(noopSubscribe, readFromWallet, () => false);
  const fromPay = useSyncExternalStore(noopSubscribe, readFromPay, () => false);
  const askedVoucher = useSyncExternalStore(noopSubscribe, readVoucherAsk, () => null);
  const keep = useKeptScroll<HTMLDivElement>();

  // A PAID VOUCHER ENDS ON THE LOYALTY CARD (Pato, MESITA-4055: "don't
  // redirect to prepay, maybe redirect to wallet … and don't leave that
  // open"). Asked from the card, Back returns to it; otherwise the card
  // replaces this page, so Back from it never reopens Offers.
  // A voucher is bought on its own ticket now (MESITA-4630), which owns where
  // a paid one returns; this page only lists the offers.
  const vouchers = usePlaceVouchers(fetched.id);
  const from: "pay" | "wallet" | null = fromPay ? "pay" : fromWallet ? "wallet" : null;
  const ticketFor = useCallback((key: string) => placeOfferPath(fetched.id, key, from), [fetched.id, from]);
  // An old ?voucher= link opens that voucher's ticket in place of this page.
  useEffect(() => {
    if (!askedVoucher) return;
    if (askedVoucher === "voucher_story") navigateTo(router, placeStoryPath(fetched.id), { replace: true });
    else if ((OFFER_TICKET_KEYS as readonly string[]).includes(askedVoucher)) navigateTo(router, ticketFor(askedVoucher), { replace: true });
  }, [askedVoucher, router, fetched.id, ticketFor]);
  const { load, loadCards } = vouchers;
  useEffect(() => {
    void load();
    void loadCards();
  }, [load, loadCards]);

  const back = useCallback(
    () => goBack(router, fromPay ? payPlacePath(fetched.id) : fromWallet ? walletPlacePath(fetched.id) : placePath(fetched.id)),
    [router, fromPay, fromWallet, fetched.id],
  );
  const place: PlaceDetail = vouchers.money ? { ...fetched, money: vouchers.money } : fetched;
  const credit = creditHere(place);

  const actions: PlaceActions = {
    onBuyVoucher: vouchers.buy,
    onOfferOpened: vouchers.opened,
    // The Story page's gate (MESITA-4296; Buy only since MESITA-4405).
    onCheckStory: vouchers.checkStory,
    // STORY IS A PAGE (MESITA-4303): pushed over this one, so Back lands
    // here; the chip's ?voucher drops first so Back never reopens a sheet.
    onOpenStory: () => navigateTo(router, placeStoryPath(fetched.id), { motion: "drill" }),
    // A VOUCHER'S TICKET (MESITA-4630): pushed over this page, so ✕ before
    // paying lands back here.
    onOpenOffer: (key) => navigateTo(router, ticketFor(key), { motion: "drill" }),
    buyingVoucher: vouchers.buying,
    // The checkout in the page (MESITA-4065): the saved cards and their pick.
    ...(vouchers.payCards ? { payCards: vouchers.payCards } : {}),
    payCardId: vouchers.payCardId,
    onSelectPayCard: vouchers.selectCard,
    onAddPayCard: () => vouchers.addCard(),
    onRetryPayCards: () => void vouchers.loadCards(),
    onLoadVouchers: vouchers.load,
    vouchersLoading: vouchers.loading,
    // The Offers (i) status (MESITA-3502): Story needs a linked Instagram;
    // its lock's action opens the page that lifts it.
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
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col" data-offers-route>
      {/* ONE LINE (Pato, 2026-11-17, MESITA-4224: "the header must only have
          one line ... the place name and profile picture"); a hairline under
          the bar (MESITA-3474). */}
      <header className="bg-card border-border z-20 flex h-14 shrink-0 items-center gap-1 border-b px-1.5">
        <button
          type="button"
          aria-label="Back"
          onClick={back}
          className="text-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
          {place.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.profilePhoto} alt="" className="bg-muted h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : null}
          <h1 className="text-foreground truncate text-base leading-tight font-semibold">{place.name}</h1>
        </div>
      </header>
      {/* The grey page under the panels (MESITA-4196), as the Reserve page. */}
      <div
        ref={keep}
        className="scrollbar-thin-dark bg-background flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4"
      >
        {/* READY NOW, PENDING AND WHEN (Pato, 2026-11-17, MESITA-4224, D3).
            Signed out there is no balance and no box (D6). */}
        {credit ? (
          // ONE DARK BOX (Pato, 2026-11-18, MESITA-4381: "just one box at the
          // top mentioning current balance"): the Loyalty Card's ink panel,
          // the balance and, while a bonus waits, the pending line.
          //
          // THE AMOUNT ONLY, NO LINK (Pato, 2026-11-21, MESITA-4633: "to
          // avoid infinitely nested routes, just cut the hyperlink … just
          // indicate amount but don't redirect to that card … block the card
          // to offers path"): no chevron, no tap. The card opens Offers; Offers
          // never opens the card, so Back from Offers lands on the card and
          // the two can't stack. It pushed the card since MESITA-4601.
          <div
            className="bg-foreground text-paper flex w-full shrink-0 flex-col gap-1 rounded-2xl p-4"
            role="group"
            aria-label={credit.label}
            data-offers-balance
          >
            <span className="text-paper/70 text-sm font-semibold">Loyalty Card · ready now</span>
            <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">{credit.ready}</span>
            {credit.pending ? (
              <span className="text-paper/70 mt-1 flex items-center gap-1.5 text-sm tabular-nums" data-offers-pending>
                <Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{credit.pending}</span>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className={credit ? "flex flex-1 shrink-0 flex-col pt-3" : "flex flex-1 shrink-0 flex-col"}>
          <VouchersPane place={place} actions={actions} />
        </div>
      </div>
      {/* The pay-with-a-card sheet the vouchers hook owns (MESITA-3552). */}
      {vouchers.sheet}
    </div>
  );
}

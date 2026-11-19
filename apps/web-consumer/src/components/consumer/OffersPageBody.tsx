"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { readyClock, VouchersPane, type PlaceActions, type VoucherKey } from "@mesita/place-profile";
import { usePlaceVouchers } from "@/components/consumer/member-place-actions";
import { money } from "@/lib/api/wallet";
import {
  CONSUMER_ROUTES,
  placePath,
  placeStoryPath,
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

/** Add Funds on a Loyalty Card (MESITA-3883): a paid offer goes back there. */
function readFromWallet(): boolean {
  return new URLSearchParams(window.location.search).get("from") === "wallet";
}

/** The voucher a Home offer chip, or the Add a card round trip, asked for
 *  (MESITA-4207, MESITA-4230). */
function readVoucherAsk(): string | null {
  return new URLSearchParams(window.location.search).get("voucher");
}

/** Rewrites this page's own query in place (no new history entry). */
function rewriteQuery(edit: (params: URLSearchParams) => void): void {
  const params = new URLSearchParams(window.location.search);
  edit(params);
  const q = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
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
  const askedVoucher = useSyncExternalStore(noopSubscribe, readVoucherAsk, () => null);
  const [askDismissed, setAskDismissed] = useState(false);
  const keep = useKeptScroll<HTMLDivElement>();

  // A PAID VOUCHER ENDS ON THE LOYALTY CARD (Pato, MESITA-4055: "don't
  // redirect to prepay, maybe redirect to wallet … and don't leave that
  // open"). Asked from the card, Back returns to it; otherwise the card
  // replaces this page, so Back from it never reopens Offers.
  const vouchers = usePlaceVouchers(fetched.id, {
    onPaid: () => {
      setAskDismissed(true);
      if (fromWallet) goBack(router, walletPlacePath(fetched.id));
      else navigateTo(router, walletPlacePath(fetched.id), { replace: true, motion: "push" });
    },
  });
  const { load, loadCards } = vouchers;
  useEffect(() => {
    void load();
    void loadCards();
  }, [load, loadCards]);

  const back = useCallback(
    () => goBack(router, fromWallet ? walletPlacePath(fetched.id) : placePath(fetched.id)),
    [router, fromWallet, fetched.id],
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
    onOpenStory: () => {
      rewriteQuery((p) => p.delete("voucher"));
      navigateTo(router, placeStoryPath(fetched.id), { motion: "drill" });
    },
    buyingVoucher: vouchers.buying,
    // The checkout in the page (MESITA-4065): the saved cards and their pick.
    ...(vouchers.payCards ? { payCards: vouchers.payCards } : {}),
    // Apple Pay / Google Pay (MESITA-4384): signed-in guests only.
    ...(vouchers.payCards ? { renderExpressPay: vouchers.renderExpress } : {}),
    payCardId: vouchers.payCardId,
    onSelectPayCard: vouchers.selectCard,
    // BACK TO THE SAME SHEET (Pato, 2026-11-17, MESITA-4230, D4): the offer
    // rides this page's address across the Add a card trip, so Back lands on
    // Offers with that offer's sheet open and the new card picked.
    onAddPayCard: (voucher?: VoucherKey) => {
      if (voucher) rewriteQuery((p) => p.set("voucher", voucher));
      vouchers.addCard();
    },
    onRetryPayCards: () => void vouchers.loadCards(),
    onLoadVouchers: vouchers.load,
    vouchersLoading: vouchers.loading,
    // The Home chip's voucher (MESITA-4207), only while its ask stands.
    askedVoucher: askDismissed ? null : askedVoucher,
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
          // the balance and, while a bonus waits, the pending line; the whole
          // box opens the Loyalty Card (back to it when Offers came from it).
          // Replaces MESITA-4320's two buttons.
          <button
            type="button"
            onClick={() =>
              fromWallet
                ? goBack(router, walletPlacePath(fetched.id))
                : navigateTo(router, walletPlacePath(fetched.id), { motion: "drill" })
            }
            aria-label={`See Loyalty Card. ${credit.label}`}
            className="bg-foreground text-paper flex w-full shrink-0 items-center gap-3 rounded-2xl p-4 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 active:scale-[0.99]"
            data-offers-balance
            data-offers-credit-link
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-paper/70 text-sm font-semibold">Loyalty Card · ready now</span>
              <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">{credit.ready}</span>
              {credit.pending ? (
                <span className="text-paper/70 mt-1 flex items-center gap-1.5 text-sm tabular-nums" data-offers-pending>
                  <Clock className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                  <span className="truncate">{credit.pending}</span>
                </span>
              ) : null}
            </span>
            <ChevronRight className="text-paper/70 h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
        <div className={credit ? "flex flex-1 shrink-0 flex-col pt-3" : "flex flex-1 shrink-0 flex-col"}>
          <VouchersPane key={actions.askedVoucher ?? "none"} place={place} actions={actions} />
        </div>
      </div>
      {/* The pay-with-a-card sheet the vouchers hook owns (MESITA-3552). */}
      {vouchers.sheet}
    </div>
  );
}

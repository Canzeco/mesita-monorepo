"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import {
  readyClock,
  voucherOffers,
  VouchersPane,
  type OffersTab,
  type PlaceActions,
  type VoucherBasketItem,
  type VoucherBuyOutcome,
} from "@mesita/place-profile";
import { usePlaceVouchers } from "@/components/consumer/member-place-actions";
import { OffersRewards, useRewardsRead } from "@/components/consumer/OffersRewards";
import { money } from "@/lib/api/wallet";
import { apiSyncInstagram } from "@/lib/api/profile";
import { EFError } from "@/lib/api/_invoke";
import {
  CONSUMER_ROUTES,
  placePath,
  payPlacePath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";
import { goBack, navigateTo, replaceAddress } from "@/lib/navigate";
import { useKeptScroll } from "@/lib/use-kept-scroll";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
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

/** VIP IS CHECKED AT CLAIM (Pato, 2026-11-22, MESITA-4659: "verify that
 *  they meet the follower requirement when they claim the offer"): the
 *  server refuses a VIP basket (`vip_recheck`) unless the follower count was
 *  read within the last hour, so the page re-reads it first when it is older. */
const VIP_CHECK_MAX_AGE_MS = 60 * 60 * 1000;

/** When the guest's follower count was last read: the later of connect and
 *  sync. Null when neither is known. */
function lastInstagramCheck(profile: { instagram_synced_at?: string | null; instagram_verified_at?: string | null } | null | undefined): number | null {
  const times = [profile?.instagram_synced_at, profile?.instagram_verified_at]
    .map((v) => (typeof v === "string" ? Date.parse(v) : NaN))
    .filter((t) => Number.isFinite(t));
  return times.length ? Math.max(...times) : null;
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

/** THE TAB IS IN THE ADDRESS (MESITA-4710): `?rewards=` names it, so a
 *  reload or Back from Pay Bill returns to the same tab. `prepayment` and
 *  `special` (the carousel's and the Wallet's links) open Prepay, `cashback`
 *  Checkout, `earned` Rewards; anything else, or none, Prepay. An asked
 *  voucher opens Prepay whatever this says (the pane decides that). */
function tabOf(rewards: string | null): OffersTab {
  if (rewards === "cashback") return "checkout";
  if (rewards === "earned") return "rewards";
  return "prepay";
}

/** The `?rewards=` value a tab writes back. */
const REWARDS_PARAM: Record<OffersTab, string> = { prepay: "prepayment", checkout: "cashback", rewards: "earned" };

// THE OFFERS PAGE (MESITA-4379, Pato: "when i click to see a profile, why the
// fuck are you showing me that … why it needs to pass across that page"):
// Offers was a full-screen sheet over the place profile at
// /place/<id>?rewards=…, so every Offers tap loaded the profile first and
// slid the sheet in over it. Now it is the place's own page, like Reserve:
// it slides in over whatever it was opened from, and Back uncovers that
// screen. The reads are the place's vouchers and the guest's saved cards
// (usePlaceVouchers), the same a voucher's ticket uses.
export function OffersPageBody({ place: fetched }: { place: PlaceDetail }) {
  const router = useRouter();
  const profileRead = useConsumerProfile();
  const profile = profileRead.data;
  const fromWallet = useSyncExternalStore(noopSubscribe, readFromWallet, () => false);
  const fromPay = useSyncExternalStore(noopSubscribe, readFromPay, () => false);
  // READ ONCE, AT MOUNT (MESITA-4710): the tab and the asked voucher
  // (`?pick=`, an old ticket link, MESITA-4647; `?voucher=`, the Add a card
  // round trip, MESITA-4230). `pick` stays a constant, so dropping it from
  // the address never empties an untouched basket.
  const params = useSearchParams();
  const [initialTab] = useState<OffersTab>(() => tabOf(params?.get("rewards") ?? null));
  const [pick] = useState<string | null>(() => params?.get("pick") ?? params?.get("voucher") ?? null);
  // Rewards reads the wallet the first time its tab opens in a visit.
  const [rewardsOpened, setRewardsOpened] = useState(initialTab === "rewards");
  const rewards = useRewardsRead(rewardsOpened);
  // A switch rewrites `?rewards=` in place (no push, no server round trip),
  // keeps `from=` and drops `pick=`/`voucher=`.
  const onTabChange = useCallback((t: OffersTab) => {
    const q = new URLSearchParams(window.location.search);
    q.set("rewards", REWARDS_PARAM[t]);
    q.delete("pick");
    q.delete("voucher");
    replaceAddress(`${window.location.pathname}?${q.toString()}`);
    if (t === "rewards") setRewardsOpened(true);
  }, []);
  const keep = useKeptScroll<HTMLDivElement>();

  // A PAID VOUCHER ENDS ON THE LOYALTY CARD (Pato, MESITA-4055: "don't
  // redirect to prepay, maybe redirect to wallet … and don't leave that
  // open"). Asked from the card, Back returns to it; otherwise the card
  // replaces this page, so Back from it never reopens Offers.
  // THE SHOP (MESITA-4647): the basket is bought here, and its receipt's
  // Done returns where Offers was opened from: from=pay the bill, from=wallet
  // the Loyalty Card; otherwise the Loyalty Card replaces Offers.
  const vouchers = usePlaceVouchers(fetched.id);
  const finish = useCallback(() => {
    if (fromPay) goBack(router, payPlacePath(fetched.id));
    else if (fromWallet) goBack(router, walletPlacePath(fetched.id));
    else navigateTo(router, walletPlacePath(fetched.id), { replace: true, motion: "push" });
  }, [router, fromPay, fromWallet, fetched.id]);
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
  // The Rewards empty state's numbers, the server's (MESITA-4710): the best
  // cashback line, and the best bonus Prepay shows (its chip's number).
  const cashback = place.money?.cashback;
  const cashbackPct = cashback ? Math.max(cashback.welcome_bps, cashback.regular_bps, cashback.vip_bps) / 100 || null : null;

  // A VIP basket re-reads the follower count first when the last read is over
  // an hour old (MESITA-4659): one Instagram sync, then the buy. `slow_down`
  // means a sync just ran, so it counts as fresh. Any other refusal shows its
  // message and charges nothing.
  const supabase = useBrowserSupabase();
  const { buy } = vouchers;
  const buyChecked = useCallback(
    async (items: VoucherBasketItem[], cardId: string | null): Promise<VoucherBuyOutcome> => {
      const hasVip = items.some((i) => i.voucher === "voucher_vip");
      const last = lastInstagramCheck(profile);
      // MESITA-4662: an emulated count in test mode is always fresh; a sync
      // would change nothing the server reads.
      const emulating = profile?.emulator_available === true && profile.instagram_followers_emulated != null;
      if (hasVip && !emulating && (last == null || Date.now() - last > VIP_CHECK_MAX_AGE_MS)) {
        try {
          await apiSyncInstagram(supabase);
        } catch (err) {
          if (!(err instanceof EFError && err.code === "slow_down")) {
            toast.error(errMsg(err, "Couldn’t check your Instagram. Try again."));
            return "failed";
          }
        }
      }
      return buy(items, cardId);
    },
    [buy, profile, supabase],
  );

  const actions: PlaceActions = {
    // MESITA-4699: Checkout's purple Pay Bill (MESITA-4710), a push to this
    // place's bill; Back returns here.
    onPay: () => navigateTo(router, payPlacePath(fetched.id), { motion: "drill" }),
    onBuyVoucher: buyChecked,
    onOfferOpened: vouchers.opened,
    onOffersDone: finish,
    buyingVoucher: vouchers.buying,
    // The checkout in the page (MESITA-4065): the saved cards and their pick.
    ...(vouchers.payCards ? { payCards: vouchers.payCards } : {}),
    payCardId: vouchers.payCardId,
    onSelectPayCard: vouchers.selectCard,
    onAddPayCard: () => vouchers.addCard(),
    onRetryPayCards: () => void vouchers.loadCards(),
    onLoadVouchers: vouchers.load,
    vouchersLoading: vouchers.loading,
    // The guest's facts for VIP's locked line (MESITA-4640).
    ...(profile
      ? {
        guest: {
          instagramLinked: Boolean(profile.instagram_handle),
          guestClass: profile.guest_class === "vip" ? "vip" : "regular",
          // MESITA-4662: the emulated count when the emulator is on (test mode).
          instagramFollowers:
            (profile.emulator_available ? profile.instagram_followers_emulated : null) ??
            profile.instagram_followers_count ??
            null,
        },
      }
      : {}),
    // "Link Instagram" on a VIP row without one (MESITA-4659): a push to Me ›
    // Instagram; Back returns here.
    onLinkInstagram: () => navigateTo(router, CONSUMER_ROUTES.mePages.instagram, { motion: "drill" }),
  };

  const bonusPct =
    voucherOffers(place.money, actions.guest).reduce((n, o) => Math.max(n, Number.parseInt(o.bonus.replace(/\D/g, ""), 10) || 0), 0) || null;

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
          // the balance and, while anything waits, the pending line
          // (pending_cents counts pending cashback and bonuses alike).
          //
          // THE AMOUNT ONLY, NO LINK (Pato, 2026-11-21, MESITA-4633: "to
          // avoid infinitely nested routes, just cut the hyperlink … just
          // indicate amount but don't redirect to that card … block the card
          // to offers path"): no chevron, no tap. The card opens Offers; Offers
          // never opens the card, so Back from Offers lands on the card and
          // the two can't stack. It pushed the card since MESITA-4601.
          //
          // ONE SMALL LINE (Pato, 2026-11-22, MESITA-4701: "current credit
          // smaller and menu more obvious"): the balance at the right of one
          // dark strip, the pending line under it only while anything waits
          // (a bonus or cashback), so the tabs below lead the page.
          <div
            className="bg-foreground text-paper flex w-full shrink-0 flex-col gap-0.5 rounded-xl px-4 py-2.5"
            role="group"
            aria-label={credit.label}
            data-offers-balance
          >
            <span className="flex items-center justify-between gap-3">
              {/* "instead of loyalty card say Current Balance" (Pato, MESITA-4702). */}
              <span className="text-paper/70 text-sm font-semibold">Current Balance</span>
              <span className="text-base font-bold tabular-nums">{credit.ready}</span>
            </span>
            {credit.pending ? (
              <span className="text-paper/70 flex items-center gap-1.5 text-xs tabular-nums" data-offers-pending>
                <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{credit.pending}</span>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className={credit ? "flex flex-1 shrink-0 flex-col pt-3" : "flex flex-1 shrink-0 flex-col"}>
          <VouchersPane
            place={place}
            actions={actions}
            pick={pick}
            initialTab={initialTab}
            onTabChange={onTabChange}
            renderRewards={(switchTab) => (
              <OffersRewards
                placeId={fetched.id}
                photo={place.profilePhoto ?? null}
                read={rewards}
                cashbackPct={cashbackPct}
                bonusPct={bonusPct}
                profileFailed={profileRead.error != null && profileRead.data == null}
                onRetryProfile={profileRead.reload}
                switchTab={switchTab}
              />
            )}
          />
        </div>
      </div>
      {/* The pay-with-a-card sheet the vouchers hook owns (MESITA-3552). */}
      {vouchers.sheet}
    </div>
  );
}

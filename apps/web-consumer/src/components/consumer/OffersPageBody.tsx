"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  PostSection,
  type PostTabRead,
  readyClock,
  VouchersPane,
  type OffersTab,
  type PlaceActions,
  type VoucherBasketItem,
  type VoucherBuyOutcome,
} from "@mesita/place-profile";
import { usePlaceVouchers } from "@/components/consumer/member-place-actions";
import { money } from "@/lib/api/wallet";
import { apiGetStoryReward, apiSimulateStory } from "@/lib/api/story";
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
 *  part with the time the next of it lands (MESITA-4714: "+$X lands at
 *  <time>"). The server's cents, formatted, never added. Null when no
 *  balance was read (signed out). */
function creditHere(place: PlaceDetail): { label: string; ready: string; pending: string | null } | null {
  const balance = place.money?.balance;
  if (!balance) return null;
  const currency = place.money?.currency ?? "mxn";
  const ready = money(balance.spendable_cents, currency);
  const at = balance.next_ready_at ? readyClock(balance.next_ready_at) : "";
  const pending = balance.pending_cents > 0
    ? `+${money(balance.pending_cents, currency)} ${at ? `lands at ${at}` : "lands soon"}`
    : null;
  return { label: `Balance ${ready}${pending ? `. ${pending}` : ""}`, ready, pending };
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
 *  Pay, `post` Post (MESITA-4714; the old `earned` of the retired Rewards
 *  tab opens Post too); anything else, or none, Prepay. An asked voucher
 *  opens Prepay whatever this says (the pane decides that). */
function tabOf(rewards: string | null): OffersTab {
  if (rewards === "cashback") return "pay";
  if (rewards === "post" || rewards === "earned") return "post";
  return "prepay";
}

/** The `?rewards=` value a tab writes back. */
const REWARDS_PARAM: Record<OffersTab, string> = { prepay: "prepayment", pay: "cashback", post: "post" };

/** POST'S READ (MESITA-4714): consumer-web-get-story-reward, the first time
 *  the tab opens in a visit (on load too); Retry reads again. Simulate (test
 *  mode) posts a story through the emulator and reads again. */
function usePostRead(placeId: string, open: boolean) {
  const supabase = useBrowserSupabase();
  const [read, setRead] = useState<PostTabRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setRead(await apiGetStoryReward(supabase, placeId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [supabase, placeId]);
  const asked = useRef(false);
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    void load();
  }, [open, load]);
  const simulate = useCallback(async () => {
    setSimulating(true);
    try {
      const r = await apiSimulateStory(supabase, placeId);
      if (r.outcome === "verified") toast.success("Story simulated and checked. The recheck pays it in a few minutes.");
      else toast.error(r.story.reason ?? "This story didn’t qualify.");
      await load();
    } catch (err) {
      toast.error(errMsg(err, "Couldn’t simulate a story. Try again."));
    } finally {
      setSimulating(false);
    }
  }, [supabase, placeId, load]);
  return { read, loading: loading || (open && !read && !failed), failed, reload: load, simulate, simulating };
}

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
  // Post reads the place's story reward the first time its tab opens.
  const [postOpened, setPostOpened] = useState(initialTab === "post");
  const post = usePostRead(fetched.id, postOpened);
  // A switch rewrites `?rewards=` in place (no push, no server round trip),
  // keeps `from=` and drops `pick=`/`voucher=`.
  const onTabChange = useCallback((t: OffersTab) => {
    const q = new URLSearchParams(window.location.search);
    q.set("rewards", REWARDS_PARAM[t]);
    q.delete("pick");
    q.delete("voucher");
    replaceAddress(`${window.location.pathname}?${q.toString()}`);
    if (t === "post") setPostOpened(true);
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
            Signed out there is no balance and no card (D6).
            THE AMOUNT ONLY, NO LINK (MESITA-4633): Offers never opens the
            Loyalty Card, so the two can't stack.
            A BLACK CARD (Pato, 2026-11-23, MESITA-4725: "better design for
            the shitty box there. maybe a black box"): the page's one anchor,
            a full card, not MESITA-4701's thin strip nor MESITA-4714's white
            card joined to the tabs. "Balance" at 70% white over the amount in
            large bold white, one 70% "+$X lands at <time>" while anything
            waits; the tab bar is its own card 12px under it. */}
        {credit ? (
          <div
            className="bg-foreground text-paper flex w-full shrink-0 flex-col gap-1 rounded-2xl p-4"
            role="group"
            aria-label={credit.label}
            data-offers-balance
          >
            <span className="text-paper/70 text-sm font-semibold">Balance</span>
            <span className="text-3xl leading-tight font-bold tabular-nums">{credit.ready}</span>
            {credit.pending ? (
              <span className="text-paper/70 truncate text-sm tabular-nums" data-offers-pending>
                {credit.pending}
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
            renderPost={() => (
              <PostSection
                read={post.read}
                loading={post.loading}
                failed={post.failed}
                onRetry={() => void post.reload()}
                // "Connect Instagram" (MESITA-4714): a push to Me › Instagram; Back returns here.
                onConnectInstagram={() => navigateTo(router, CONSUMER_ROUTES.mePages.instagram, { motion: "drill" })}
                onSimulate={() => void post.simulate()}
                simulating={post.simulating}
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

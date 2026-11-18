"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { readCached, writeCached } from "@/lib/screen-cache";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PayCard, PayCards, PlaceActions, PlaceMenuItem, PlaceMoney, RewardsSection, StoryCheckAnswer, VoucherBasketItem, VoucherBuyOutcome, VoucherKey } from "@mesita/place-profile";
import { pickPayCard } from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import {
  apiBuyVoucher,
  apiCheckStory,
  apiEmulateStory,
  apiListVouchers,
  BUY_REFUSAL,
  buyRefusalAction,
  isDefinitiveRefusal,
  STORY_EMULATOR_REFUSAL,
} from "@/lib/api/wallet";
import { apiListCards, brandLabel } from "@/lib/api/cards";
import { runBankCheck } from "@/lib/api/tab";
import { useAddCardPage } from "@/lib/added-card";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import { RewardsSheet } from "@/components/consumer/RewardsSheet";
import { PlaceSocialList } from "@/components/consumer/PlaceSocialList";
import {
  apiPlaceActivity,
  apiTrackActivity,
  isMesitaPlaceId,
  type PlaceActivity,
} from "@/lib/api/activity";
import { apiGetBoost, type PlaceBoost } from "@/lib/api/boost";
import type { PlaceDetail } from "@/lib/place-detail";
import { useSavedPlaces } from "@/lib/saved-places";
import { sharePlace } from "@/lib/share-place";
import { useBrowserSupabase, useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot } from "@/lib/use-user-location";
import { goBack, navigateTo } from "@/lib/navigate";
import { CONSUMER_ROUTES, payPlacePath, placeReservePath, placeStoryPath, reservationPath, walletPlacePath } from "@/lib/consumer-route-contract";
import { apiListReservations, type EFReservationRow } from "@/lib/api/reservations";
import { statusLabel, whenLine } from "@/lib/reservation-when";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { toast } from "@/lib/toast";

// THE SECONDARY SHEETS LOAD AFTER THE PLACE PAINTS (MESITA-3014). Each
// opens on a tap, so none belongs in the first frame's bundle; they are
// fetched once the screen is up, well before a finger reaches them. Reserve
// is the screen's main action, so its sheet stays in the first bundle and
// opens on the tap itself.
const PlaceMoreSheet = dynamic(() =>
  import("@/components/consumer/place-detail/PlaceMoreSheet").then(
    (m) => m.PlaceMoreSheet,
  ),
);
const ReportSheet = dynamic(() =>
  import("@/components/consumer/place-detail/ReportSheet").then(
    (m) => m.ReportSheet,
  ),
);
const MenuViewer = dynamic(() =>
  import("@/components/consumer/MenuViewer").then((m) => m.MenuViewer),
);
const BoostSheet = dynamic(() =>
  import("@/components/consumer/place-detail/BoostSheet").then(
    (m) => m.BoostSheet,
  ),
);

// One hook per member surface so the body and the Reserve bar share the
// sheets. The shared renderer stays presentational.
//
// Social v1 (MESITA-2442): opening the profile records `viewed`; the line
// under the title comes from consumer-web-list-place-likes. There is no
// "I went" (MESITA-2567: Social is liked and viewed only).
//
// THE VIEW THAT STARTS ENRICH SHOWS IT (Pato, MESITA-2952: "return the
// enriching tag when created, just for user to understand that the place is
// being enriched"). With "Enrich after N views" at 1, this open is the view
// that starts the run, after the page loaded `ready`. The `viewed` answer
// says so, and `place` comes back Enriching until the place is Enriched.
/** How long the screen waits on the Wallet and reservation reads before it
 *  paints without them (MESITA-3803): a stuck read never strands the guest
 *  on the skeleton; whatever lands later fills in. */
export const FIRST_READS_CAP_MS = 3_000;

function noopSubscribe() {
  return () => {};
}

/** The ask came from a Loyalty Card's Buy Credits (MESITA-3883): closing the
 *  Offers page goes back there, not down to the profile. */
function readFromWallet(): boolean {
  return new URLSearchParams(window.location.search).get("from") === "wallet";
}

/** The voucher a Home offer chip asked for (MESITA-4207). */
function readVoucherAsk(): string | null {
  return new URLSearchParams(window.location.search).get("voucher");
}

function readRewardsAsk(): RewardsSection | null {
  const v = new URLSearchParams(window.location.search).get("rewards");
  // "payment" is ignored on purpose: the Payments card left Offers (MESITA-4062).
  return v === "prepayment" || v === "special" ? v : null;
}

export function useMemberPlaceActions(place: PlaceDetail): {
  /** The place to draw: Enriching once a view found it mid-run. */
  place: PlaceDetail;
  /** The Wallet and reservation reads are in (MESITA-3803): draw the
   *  place's skeleton until then, so the profile paints in one frame. */
  ready: boolean;
  actions: PlaceActions;
  sheets: ReactNode;
  social: ReactNode;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const router = useRouter();
  const profile = useConsumerProfile().data;
  const saved = isSaved(place.id);
  const [contactOpen, setContactOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Prepay opens the Offers sheet (MESITA-3412).
  const [rewards, setRewards] = useState<RewardsSection | null>(null);
  // ?rewards=prepayment|special (the Home tile's offer button,
  // MESITA-3439, its slides since MESITA-3467)
  // opens the sheet on arrival, once: closing it drops the ask.
  const askedRewards = useSyncExternalStore(noopSubscribe, readRewardsAsk, () => null);
  const fromWallet = useSyncExternalStore(noopSubscribe, readFromWallet, () => false);
  const askedVoucher = useSyncExternalStore(noopSubscribe, readVoucherAsk, () => null);
  const [askDismissed, setAskDismissed] = useState(false);
  const rewardsShown = rewards ?? (askDismissed ? null : askedRewards);
  // When the Upgrade tile or ⋯ › Upgrade last asked for the Upgrade sheet (ms).
  const [boostAskedAt, setBoostAskedAt] = useState(0);
  const [boostClosedAt, setBoostClosedAt] = useState(0);
  const onBoost = () => setBoostAskedAt(Date.now());
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const activity = usePlaceActivity(place.id);
  const boost = usePlaceBoost(place.id);
  // A PAID VOUCHER ENDS ON THE LOYALTY CARD (Pato, MESITA-4055: "don't
  // redirect to prepay, maybe redirect to wallet … and don't leave that
  // open"). A saved card's payment that succeeded or is processing closes
  // the Offers page, drops ?rewards and ?from so Back never reopens it, and
  // opens this place's Loyalty Card, where Stripe's page already lands
  // (MESITA-3617). Asked from the Loyalty Card, it goes back there.
  const vouchers = usePlaceVouchers(place.id, {
    onPaid: () => {
      setRewards(null);
      setAskDismissed(true);
      const params = new URLSearchParams(window.location.search);
      params.delete("rewards");
      params.delete("from");
      params.delete("voucher");
      const q = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
      if (fromWallet) goBack(router, walletPlacePath(place.id));
      else navigateTo(router, walletPlacePath(place.id), { motion: "drill" });
    },
  });
  const reservation = usePlaceReservation(place.id);
  const live = reservation.row;
  // ONE READ, ONE PAINT (Pato, MESITA-3803: "call those two functions in
  // parallel from the frontend and await them … i don't like that you load
  // and display items in different orders and not all at the same time").
  // The Wallet tile's credit (MESITA-3574) and the guest's table here
  // (MESITA-3640) are asked together when the screen opens; the place's
  // skeleton stays until both answered or failed, so the profile lands
  // whole instead of the Wallet flipping Off → $0.00MX and the reservation
  // button popping in under it. A stuck read gives up the wait after
  // FIRST_READS_CAP_MS. State is set in callbacks only (Next 16 lint).
  const loadVouchers = vouchers.load;
  const loadCards = vouchers.loadCards;
  const loadReservation = reservation.load;
  const [readFor, setReadFor] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) setReadFor(place.id);
    };
    const cap = setTimeout(done, FIRST_READS_CAP_MS);
    void Promise.all([loadVouchers(), loadReservation()]).finally(() => {
      clearTimeout(cap);
      done();
    });
    return () => {
      cancelled = true;
      clearTimeout(cap);
    };
  }, [loadVouchers, loadReservation, place.id]);
  // The saved cards for the Offers page's "Pay with" (MESITA-4065): read
  // beside the first reads, never holding the profile's first paint.
  useEffect(() => {
    void loadCards();
  }, [loadCards]);
  // A Google-only card has neither read: it paints at once.
  const ready = !isMesitaPlaceId(place.id) || readFor === place.id;
  // Stripe Checkout's return asks for the sheet too: it is open while the
  // latest ask is newer than the last close (MESITA-3201).
  const boostOpen = Math.max(boostAskedAt, boost.returnedAt ?? 0) > boostClosedAt;

  const onSave = useCallback(() => {
    const nowSaved = !saved;
    toggle(place.id);
    if (nowSaved) toast.success(`Added ${place.name} to favorites`);
    else toast(`Removed ${place.name} from favorites`);
  }, [place.id, place.name, saved, toggle]);

  const onOpenLink = useCallback((url: string) => {
    if (url.startsWith("tel:")) {
      window.location.href = url;
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const actions: PlaceActions = {
    onSave,
    saved,
    onContact: () => setContactOpen(true),
    onShare: () => void sharePlace(place),
    // The three dots open the menu (MESITA-2692).
    onMore: () => setMoreOpen(true),
    // The full Reserve page (MESITA-3609), not a sheet.
    onReserve: () => navigateTo(router, placeReservePath(place.id), { motion: "drill" }),
    // The guest's one live table here (MESITA-3640), under the four tiles.
    reservation: live
      ? {
        when: whenLine(live.reserved_at, place.timezone || null),
        status: statusLabel(live),
        confirmed: toReservationItem(live).state === "confirmed",
        onOpen: () => navigateTo(router, reservationPath(live.id), { motion: "drill" }),
      }
      : null,
    onBoost,
    onOpenMenu: (item) => setMenu(item),
    onOpenLink,
    // The Social tab (MESITA-3417): this place's activity; a Google-only
    // card has none, so it keeps the package's empty screen.
    ...(isMesitaPlaceId(place.id)
      ? { renderSocial: () => <PlaceSocialList placeId={place.id} /> }
      : {}),
    // Prepay and Pay (MESITA-3412): the Rewards sheet, once the fourth tab.
    onOpenRewards: setRewards,
    // The Rewards sheet (MESITA-3303): Buy asks how to pay (a saved card in
    // one tap, or Stripe's page, MESITA-3552); opening the sheet refreshes
    // the offer and the credit.
    onBuyVoucher: vouchers.buy,
    // The Story sheet's check before Pay and its test-mode simulator (MESITA-4296).
    onCheckStory: vouchers.checkStory,
    onSimulateStory: vouchers.simulateStory,
    // STORY IS A PAGE (MESITA-4303): Offers stays in this address
    // (?rewards=special, no ?voucher) so Back from Story reopens Offers, never Story.
    onOpenStory: () => {
      const params = new URLSearchParams(window.location.search);
      params.set("rewards", "special");
      params.delete("voucher");
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
      navigateTo(router, placeStoryPath(place.id), { motion: "drill" });
    },
    buyingVoucher: vouchers.buying,
    // The checkout in the page (MESITA-4065): the saved cards and their pick.
    ...(vouchers.payCards ? { payCards: vouchers.payCards } : {}),
    payCardId: vouchers.payCardId,
    onSelectPayCard: vouchers.selectCard,
    // BACK TO THE SAME SHEET (Pato, 2026-11-17, MESITA-4230, D4): the offer
    // rides this page's address across the Add a card trip, so Back lands on
    // Offers with that offer's sheet open and the new card picked.
    onAddPayCard: (voucher?: VoucherKey) => {
      if (voucher) {
        const params = new URLSearchParams(window.location.search);
        params.set("rewards", "prepayment");
        params.set("voucher", voucher);
        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
      }
      vouchers.addCard();
    },
    onRetryPayCards: () => void vouchers.loadCards(),
    onLoadVouchers: vouchers.load,
    vouchersLoading: vouchers.loading,
    // Pay (the Offers tile's Pay slide, MESITA-3352, MESITA-4151): this
    // place's bill, /pay/place/<placeId> (MESITA-3614), the one door every "pay
    // here" uses; the sheet closes on the way out.
    onPay: () => {
      setRewards(null);
      setAskDismissed(true);
      navigateTo(router, payPlacePath(place.id), { motion: "drill" });
    },
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
        },
      }
      : {}),
    onLinkInstagram: () => {
      setRewards(null);
      navigateTo(router, CONSUMER_ROUTES.mePages.instagram, { motion: "drill" });
    },
  };

  const enriching =
    activity.enriching && !place.is_enriched && !place.is_enriching;
  const shown =
    enriching || vouchers.money
      ? {
          ...place,
          ...(enriching ? { is_enriching: true } : {}),
          ...(vouchers.money ? { money: vouchers.money } : {}),
        }
      : place;
  const sheets = (
    <>
      <PlaceContactSheet
        place={place}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
      <BoostSheet
        place={place}
        boost={boost.data}
        loading={boost.loading}
        failed={boost.failed}
        onRetry={boost.reload}
        open={boostOpen}
        onClose={() => setBoostClosedAt(Date.now())}
      />
      {/* Before the menu and report sheets: the full-screen Offers page
          (MESITA-3448) opens its ⋯ menu on top of itself. */}
      <RewardsSheet
        place={shown}
        actions={actions}
        section={rewardsShown}
        onClose={() => {
          if (fromWallet && rewards == null && !askDismissed && askedRewards != null) {
            goBack(router, walletPlacePath(place.id));
            return;
          }
          setRewards(null);
          setAskDismissed(true);
        }}
      />
      <PlaceMoreSheet
        place={place}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        saved={saved}
        onSave={onSave}
        onBoost={onBoost}
        // A Google-only card is not a place row yet: nothing to report.
        onReport={
          isMesitaPlaceId(place.id) ? () => setReportOpen(true) : undefined
        }
      />
      <ReportSheet
        place={place}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
      <MenuViewer
        open={menu != null}
        onClose={() => setMenu(null)}
        menu={menu}
      />
      {vouchers.sheet}
    </>
  );

  return {
    place: shown,
    ready,
    actions,
    sheets,
    social: activity.social,
  };
}

// Vouchers (MESITA-3303): the tab's fresh offer and the one buy. The place
// read carried an offer already; the tab asks again because the screen
// may be served from the store and the guest's credit changes. A refusal
// says the server's line and refreshes the offer so the tab shows why.
//
// HOW TO PAY (MESITA-3552): Buy opens a small sheet with the guest's saved
// cards. A card is one tap: it is charged on the place's own account; a
// bank check (3-D Secure) runs in Stripe.js, then the same tap is asked
// again (the same request_id: never a second charge) for how it ended.
// "Pay on Stripe's page" is the Checkout as before; "Add a card" saves one
// on Stripe's page and comes back here.
/** The guest's live reservation at this place, if any (MESITA-3640: one per
 *  place). `upcoming` is exactly "live" server-side (pending or confirmed,
 *  slot within the 4h grace). A failed read draws no button. */
function usePlaceReservation(placeId: string): {
  row: EFReservationRow | null;
  /** Reads it; resolves once it answered or failed (never rejects). */
  load: () => Promise<void>;
} {
  // The memoized client: the lazy getter is a new closure each render and
  // would refetch forever in an effect (MESITA-3207).
  const supabase = useBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [found, setFound] = useState<{ placeId: string; row: EFReservationRow | null } | null>(null);
  const load = useCallback(async () => {
    if (!mesita) return;
    const row = await apiListReservations(supabase, { scope: "upcoming", limit: 100 })
      .then(({ reservations }) => reservations.find((r) => r.place?.id === placeId) ?? null)
      .catch(() => null);
    // Keyed by place: an answer for a place left behind is never drawn.
    setFound({ placeId, row });
  }, [mesita, placeId, supabase]);
  return { row: found?.placeId === placeId ? found.row : null, load };
}

export function usePlaceVouchers(
  placeId: string,
  /** `onPaid` runs when a card payment succeeded or is still processing, never
   *  on a declined, abandoned or failed attempt: the Loyalty Card reads the
   *  Wallet again from it (MESITA-3868). */
  opts: { onPaid?: () => void } = {},
): {
  money: PlaceMoney | null;
  /** The last list-vouchers for this place failed (MESITA-3868). */
  failed: boolean;
  /** The basket's lead voucher while it is being paid. */
  buying: VoucherKey | null;
  /** The first list-vouchers for this place has not answered (MESITA-3388). */
  loading: boolean;
  /** Reads the offer and the credit; resolves once it answered or failed. */
  load: () => Promise<void>;
  /** The Offers page's basket (MESITA-3841) paid with the card it drew
   *  (MESITA-4065); no card opens the card sheet. */
  buy: (items: VoucherBasketItem[], cardId: string | null, opts?: { mentionId?: string }) => Promise<VoucherBuyOutcome>;
  /** The Story sheet's check (MESITA-4296). */
  checkStory: (opts: { poll: boolean }) => Promise<StoryCheckAnswer>;
  /** Test mode: post a sample story; null when posted, else the refusal's line. */
  simulateStory: () => Promise<string | null>;
  /** The guest's saved cards; undefined signed out or off Mesita. */
  payCards: PayCards | undefined;
  payCardId: string | null;
  selectCard: (id: string) => void;
  /** Opens the in-app card sheet. */
  addCard: () => void;
  /** Reads the cards; resolves once it answered or failed. */
  loadCards: () => Promise<void>;
  sheet: ReactNode;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  // ONE RESULT PER PLACE (MESITA-3868): the offer or none, and whether the
  // read failed. Written in the promise callbacks only (Next 16 lint), and
  // only by the latest request, so an older answer never lands last. An
  // answer with no offer clears earlier rows; a failed read keeps them.
  const [offer, setOffer] = useState<{ placeId: string; money: PlaceMoney | null; failed: boolean } | null>(null);
  const request = useRef(0);
  const onPaid = useRef(opts.onPaid);
  useEffect(() => {
    onPaid.current = opts.onPaid;
  });
  const [buying, setBuying] = useState<VoucherKey | null>(null);
  const load = useCallback(async () => {
    if (!mesita) return;
    const mine = ++request.current;
    await apiListVouchers(getSupabase(), placeId)
      .then(({ money }) => {
        if (mine !== request.current) return;
        setOffer({ placeId, money: money ?? null, failed: false });
      })
      .catch(() => {
        if (mine !== request.current) return;
        // The offer already on screen stays; the read is marked failed.
        setOffer((prev) => ({ placeId, money: prev?.placeId === placeId ? prev.money : null, failed: true }));
      });
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesita, placeId]);

  // THE CHECKOUT IS THE OFFERS PAGE (MESITA-4065, Pato: "you simply select
  // the item and select the payment method and click the button to pay …
  // you need to first add the card"). The guest's saved cards are read with
  // the offer; the page draws them under the vouchers and its one Pay
  // charges the selected card. No second sheet, no Stripe page: a guest with
  // no card adds one on the Add a card page first (MESITA-4101).
  const [payCards, setPayCards] = useState<PayCards | undefined>(undefined);
  const [payCardId, setPayCardId] = useState<string | null>(null);
  const userKey = useRef<string | null>(null);
  const cardsRequest = useRef(0);
  const loadCards = useCallback(async () => {
    if (!mesita) return;
    const mine = ++cardsRequest.current;
    // State is set after an await only (Next 16 lint: no setState in an effect body).
    await Promise.resolve();
    if (mine !== cardsRequest.current) return;
    setPayCards((prev) => (prev?.state === "ready" ? prev : { state: "loading" }));
    try {
      const supabase = getSupabase();
      const [{ cards }, session] = await Promise.all([apiListCards(supabase), supabase.auth.getSession()]);
      if (mine !== cardsRequest.current) return;
      userKey.current = session.data.session?.user.id ?? null;
      const list: PayCard[] = cards.map((c) => ({ id: c.id, label: brandLabel(c.brand), last4: c.last4, exp_month: c.exp_month, exp_year: c.exp_year }));
      setPayCards({ state: "ready", cards: list });
      setPayCardId((prev) => (prev && list.some((c) => c.id === prev) ? prev : pickPayCard(list, readLastCard(userKey.current))));
    } catch (err) {
      if (mine !== cardsRequest.current) return;
      // Signed out: no "Pay with"; Pay opens the card sheet, which says why.
      setPayCards(err instanceof EFError && err.code === "sign_in" ? undefined : { state: "error" });
    }
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesita]);

  const selectCard = useCallback((id: string) => setPayCardId(id), []);
  const openAddCard = useAddCardPage((id) => {
    setPayCardId(id);
    writeLastCard(userKey.current, id);
    toast.success("Card saved. Tap Pay to buy.");
    void loadCards();
  });

  // ONE request_id PER BASKET AND CARD (MESITA-4065): kept across every retry
  // after an unknown outcome (no answer, a 5xx, card_failed), so the server
  // finds the same purchase and never charges twice; dropped on a definitive
  // answer. Three unknown outcomes in a row stop with "check Wallet".
  const pending = useRef<{ key: string; requestId: string; unknown: number } | null>(null);

  const buy = useCallback(
    async (what: VoucherBasketItem[], cardId: string | null, opts: { mentionId?: string } = {}): Promise<VoucherBuyOutcome> => {
      if (!mesita) return "failed";
      const items = what.filter((i) => i.qty > 0);
      if (items.length === 0) return "failed";
      if (!cardId) {
        openAddCard();
        return "failed";
      }
      // A Story names its story (MESITA-4296): another story is another buy.
      const key = `${cardId}|${items.map((i) => `${i.voucher}x${i.qty}`).join(",")}|${opts.mentionId ?? ""}`;
      if (pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID(), unknown: 0 };
      if (pending.current.unknown >= 3) {
        toast(BUY_REFUSAL.unconfirmed, { tone: "error" });
        return "failed";
      }
      setBuying(items[0].voucher);
      // One voucher reads exactly as before; a basket sends its lines, one
      // charge for all (MESITA-3841).
      const one = items.length === 1 && items[0].qty === 1;
      const args = {
        place_id: placeId,
        ...(one ? { voucher: items[0].voucher } : { items }),
        request_id: pending.current.requestId,
        card_pm_id: cardId,
        ...(opts.mentionId ? { mention_id: opts.mentionId } : {}),
      } as Parameters<typeof apiBuyVoucher>[1];
      try {
        let r = await apiBuyVoucher(getSupabase(), args);
        if (r.card.status === "requires_action") {
          if ((await runBankCheck(r.card)) === "unavailable") {
            toast("Couldn't open the bank check. Try again.", { tone: "error" });
          }
          // The same purchase again: how the card payment ended.
          r = await apiBuyVoucher(getSupabase(), args);
        }
        if (r.card.status === "succeeded" || r.card.status === "processing") {
          pending.current = null;
          writeLastCard(userKey.current, cardId);
          // The Offers sheet's receipt says it (MESITA-4224): no toast.
          onPaid.current?.();
          return r.card.status === "succeeded" ? "paid" : "processing";
        }
        toast("Your bank didn't confirm the payment.", { tone: "error" });
        return "failed";
      } catch (err: unknown) {
        const code = err instanceof EFError ? err.code : null;
        const status = err instanceof EFError ? err.status : null;
        if (isDefinitiveRefusal(status, code)) pending.current = null;
        else if (pending.current) pending.current.unknown += 1;
        const field = err instanceof EFError && err.body && typeof err.body.field === "string" ? err.body.field : null;
        const action = buyRefusalAction(code, field);
        // A Story refusal (MESITA-4296): nothing was charged; the sheet goes
        // back to its check step and says why there, no toast.
        if (action.kind === "story") return { story_refused: action.line };
        if (action.kind === "add_card") openAddCard();
        if (action.kind === "reload_cards") void loadCards();
        const line = !isDefinitiveRefusal(status, code) && pending.current && pending.current.unknown >= 3 ? BUY_REFUSAL.unconfirmed : action.line;
        toast(line, { tone: "error" });
        if (action.kind === "say" && action.reload) void load();
        return "failed";
      } finally {
        setBuying(null);
        void load();
      }
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesita, placeId, load, loadCards],
  );

  const checkStory = useCallback(
    (o: { poll: boolean }): Promise<StoryCheckAnswer> =>
      mesita ? apiCheckStory(getSupabase(), placeId, o.poll) : Promise.resolve({ kind: "failed" }),
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesita, placeId],
  );
  const simulateStory = useCallback(async (): Promise<string | null> => {
    try {
      await apiEmulateStory(getSupabase(), "post");
      return null;
    } catch (err) {
      const code = err instanceof EFError ? err.code : null;
      return (code && STORY_EMULATOR_REFUSAL[code]) || STORY_EMULATOR_REFUSAL.emulate_failed;
    }
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mine = offer?.placeId === placeId ? offer : null;
  const money = mine?.money ?? null;
  // Add a card: its own page since MESITA-4101 (/wallet/cards/new); back
  // here the new card is the selected one. The basket is not kept, so the
  // guest taps Pay again.
  const sheet = null;

  return {
    money,
    failed: mine?.failed === true,
    buying,
    loading: mesita && mine === null,
    load,
    buy: (items, cardId, opts) => buy(items, cardId, opts),
    checkStory,
    simulateStory,
    payCards,
    payCardId,
    selectCard,
    addCard: () => openAddCard(),
    loadCards,
    sheet,
  };
}

/** The last card the guest paid with, per user on this device (MESITA-4065).
 *  Storage can throw (private mode): then nothing is remembered. */
const LAST_CARD_KEY = "mesita.pay.last-card.";
function readLastCard(user: string | null): string | null {
  if (!user) return null;
  try {
    return window.localStorage.getItem(LAST_CARD_KEY + user);
  } catch {
    return null;
  }
}
function writeLastCard(user: string | null, cardId: string): void {
  if (!user) return;
  try {
    window.localStorage.setItem(LAST_CARD_KEY + user, cardId);
  } catch {
    // nothing remembered
  }
}

// Premier (MESITA-3168): the place's level and the guest's Refill packs.
// Checkout returns with `?refill=<session>`: settle it, say what happened
// only from the server's line, and drop the parameter so a reload does not
// settle twice. A payment still confirming is asked again for up to 20
// seconds.
const CONFIRM_POLL_MS = 2_500;
const CONFIRM_POLL_FOR_MS = 20_000;

function sayCheckoutOutcome(data: PlaceBoost) {
  const p = data.purchase;
  if (!p) return;
  if (p.status === "granted") toast.success(`${p.line}.`);
  else if (p.status === "open")
    toast(
      "Still confirming. This updates on its own; you won't be charged twice.",
    );
  else toast(`${p.line}.`);
}

const boostKey = (placeId: string) => `boost:${placeId}`;

function usePlaceBoost(placeId: string): {
  data: PlaceBoost | null;
  loading: boolean;
  failed: boolean;
  /** When Checkout last sent the guest back here (ms), else null. */
  returnedAt: number | null;
  reload: () => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{
    placeId: string;
    nonce: number;
    data: PlaceBoost | null;
    failed: boolean;
  }>(() => ({
    placeId,
    nonce: -1,
    // A boost read kept from an earlier open paints at once (MESITA-3014).
    data: readCached<PlaceBoost>(boostKey(placeId)),
    failed: false,
  }));
  const [nonce, setNonce] = useState(0);
  const [returned, setReturned] = useState<{
    placeId: string;
    at: number;
  } | null>(null);

  useEffect(() => {
    if (!mesita) return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const session = params.get("refill") ?? undefined;
    if (session) {
      params.delete("refill");
      const q = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${q ? `?${q}` : ""}`,
      );
    }
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = (): Promise<PlaceBoost> =>
      apiGetBoost(getSupabase(), placeId, session).then((data) => {
        if (
          session &&
          !cancelled &&
          data.purchase?.status === "open" &&
          Date.now() - startedAt < CONFIRM_POLL_FOR_MS
        ) {
          return new Promise<PlaceBoost>((resolve, reject) => {
            timer = setTimeout(
              () => void read().then(resolve, reject),
              CONFIRM_POLL_MS,
            );
          });
        }
        return data;
      });
    if (session) toast("Confirming your payment…");
    void read()
      .then((data) => {
        if (cancelled) return;
        setState({ placeId, nonce, data, failed: false });
        // A checkout return reads fresh and is never served from the store;
        // its answer still updates what the next open paints.
        writeCached(boostKey(placeId), data);
        if (session) setReturned({ placeId, at: Date.now() });
        if (session) sayCheckoutOutcome(data);
      })
      .catch(() => {
        if (!cancelled)
          setState((s) => ({
            placeId,
            nonce,
            data: s.placeId === placeId ? s.data : null,
            failed: true,
          }));
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, mesita, nonce]);

  const fresh = state.placeId === placeId;
  const data = mesita && fresh ? state.data : null;
  return {
    data,
    // A kept read is shown while the fresh one is out, so it is not loading.
    loading: mesita && (!fresh || state.nonce !== nonce) && data == null,
    failed: mesita && fresh && state.failed,
    returnedAt: mesita && returned?.placeId === placeId ? returned.at : null,
    reload: () => setNonce((n) => n + 1),
  };
}

function usePlaceActivity(placeId: string): {
  social: ReactNode;
  enriching: boolean;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{
    placeId: string;
    activity: PlaceActivity | null;
  }>({ placeId, activity: null });
  // The place this page's view found mid-Enrich (MESITA-2952).
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  useEffect(() => {
    if (!mesita) return;
    let cancelled = false;
    const supabase = getSupabase();
    // Viewed first, so the guest's own open counts in the line it reads.
    // Where the view happened (MESITA-2853): the device fix, if any.
    void apiTrackActivity(supabase, {
      kind: "viewed",
      placeId,
      at: locationSnapshot().coords,
    })
      .then((tracked) => {
        if (!cancelled && tracked.enriching) setEnrichingId(placeId);
      })
      .catch(() => {})
      .then(() => apiPlaceActivity(supabase, placeId))
      .then((activity) => {
        if (!cancelled) setState({ placeId, activity });
      })
      .catch(() => {
        /* no line is the empty state */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, mesita]);

  const activity = state.placeId === placeId ? state.activity : null;
  const social = activity?.line ? (
    <SocialLine faces={activity.people} text={activity.line} />
  ) : null;

  // A Google-only card has no place row yet: no line.
  return {
    social: mesita ? social : null,
    enriching: mesita && enrichingId === placeId,
  };
}

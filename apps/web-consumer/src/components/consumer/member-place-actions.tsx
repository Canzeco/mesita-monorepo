"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { readCached, writeCached } from "@/lib/screen-cache";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PlaceActions, PlaceMenuItem, PlaceMoney, RewardsSection, VoucherKey } from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import { apiAddHouseCard, apiBuyVoucher, apiListVouchers, BUY_REFUSAL, buyRefusalAction, money as moneyLabel } from "@/lib/api/wallet";
import { apiAddCard, apiListCards, CARD_REFUSAL, type SavedCard } from "@/lib/api/cards";
import { runBankCheck } from "@/lib/api/tab";
import { VoucherPaySheet } from "@/components/consumer/VoucherPaySheet";
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
import { navigateTo } from "@/lib/navigate";
import { CONSUMER_ROUTES, payPlacePath, placeReservePath, reservationPath, walletPlacePath } from "@/lib/consumer-route-contract";
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
const FIRST_READS_CAP_MS = 3_000;

function noopSubscribe() {
  return () => {};
}

function readRewardsAsk(): RewardsSection | null {
  const v = new URLSearchParams(window.location.search).get("rewards");
  return v === "prepayment" || v === "payment" || v === "special" ? v : null;
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
  // Prepay and Pay open the Rewards sheet at their section (MESITA-3412).
  const [rewards, setRewards] = useState<RewardsSection | null>(null);
  // ?rewards=prepayment|payment|special (the Home tile's offer button,
  // MESITA-3439, its slides since MESITA-3467)
  // opens the sheet on arrival, once: closing it drops the ask.
  const askedRewards = useSyncExternalStore(noopSubscribe, readRewardsAsk, () => null);
  const [askDismissed, setAskDismissed] = useState(false);
  const rewardsShown = rewards ?? (askDismissed ? null : askedRewards);
  // When the Upgrade tile or ⋯ › Upgrade last asked for the Upgrade sheet (ms).
  const [boostAskedAt, setBoostAskedAt] = useState(0);
  const [boostClosedAt, setBoostClosedAt] = useState(0);
  const onBoost = () => setBoostAskedAt(Date.now());
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const activity = usePlaceActivity(place.id);
  const boost = usePlaceBoost(place.id);
  const vouchers = usePlaceVouchers(place.id);
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
    buyingVoucher: vouchers.buying,
    onLoadVouchers: vouchers.load,
    vouchersLoading: vouchers.loading,
    // Pay (the pinned row's tile and the Cashback card's, MESITA-3352): this
    // place's bill, /pay/<placeId> (MESITA-3614), the one door every "pay
    // here" uses; the sheet closes on the way out.
    onPay: () => {
      setRewards(null);
      setAskDismissed(true);
      navigateTo(router, payPlacePath(place.id), { motion: "drill" });
    },
    // The pinned row's Wallet tile (MESITA-3574): this place's House Card,
    // /wallet/<placeId> (MESITA-3614); its pill reads the list-vouchers
    // balance below.
    onOpenWallet: () => navigateTo(router, walletPlacePath(place.id), { motion: "drill" }),
    // The Wallet tile's Off sheet (MESITA-3583): "Add card to Wallet" pins
    // this place's House Card with $0; the sheet says when it already is.
    ...(isMesitaPlaceId(place.id)
      ? { houseCardInWallet: vouchers.inWallet, onAddHouseCard: vouchers.addHouseCard }
      : {}),
    // The Offers (i) status (MESITA-3502): VIP needs the VIP Class, Story a
    // linked Instagram; each lock's action opens the page that lifts it.
    ...(profile
      ? {
        guest: {
          vip: profile.guest_class === "vip",
          instagramLinked: Boolean(profile.instagram_handle),
          instagramFollowers: profile.instagram_followers_count ?? null,
        },
      }
      : {}),
    onJoinVip: () => {
      setRewards(null);
      navigateTo(router, CONSUMER_ROUTES.mePages.class, { motion: "drill" });
    },
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

function usePlaceVouchers(placeId: string): {
  money: PlaceMoney | null;
  /** This place's House Card is in the guest's Wallet (MESITA-3582). */
  inWallet: boolean | undefined;
  /** Pins it with $0; resolves true once it is in the Wallet. */
  addHouseCard: () => Promise<boolean>;
  buying: VoucherKey | null;
  /** The first list-vouchers for this place has not answered (MESITA-3388). */
  loading: boolean;
  /** Reads the offer and the credit; resolves once it answered or failed. */
  load: () => Promise<void>;
  buy: (key: VoucherKey) => void;
  sheet: ReactNode;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{ placeId: string; money: PlaceMoney } | null>(null);
  const [card, setCard] = useState<{ placeId: string; inWallet: boolean } | null>(null);
  const [buying, setBuying] = useState<VoucherKey | null>(null);
  // The voucher whose "how to pay" sheet is open, and the saved cards
  // (null while they load).
  const [choosing, setChoosing] = useState<VoucherKey | null>(null);
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  // The place whose list-vouchers answered, either way; set only in the
  // promise callbacks, never synchronously in an effect (Next 16 lint).
  const [settled, setSettled] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!mesita) return;
    await apiListVouchers(getSupabase(), placeId)
      .then(({ money, inWallet }) => {
        if (money) setState({ placeId, money });
        if (inWallet !== undefined) setCard({ placeId, inWallet });
      })
      .catch(() => {
        // The place read's offer stays on screen.
      })
      .finally(() => setSettled(placeId));
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesita, placeId]);

  const addHouseCard = useCallback(
    async () => {
      if (!mesita) return false;
      try {
        await apiAddHouseCard(getSupabase(), placeId);
        setCard({ placeId, inWallet: true });
        return true;
      } catch {
        return false;
      }
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesita, placeId],
  );

  const buy = useCallback(
    (key: VoucherKey) => {
      if (!mesita) return;
      setChoosing(key);
      setCards(null);
      void apiListCards(getSupabase())
        .then((r) => setCards(r.cards))
        // No list: Stripe's page and Add a card still work.
        .catch(() => setCards([]));
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesita],
  );

  const checkout = useCallback(
    (key: VoucherKey) => {
      setBuying(key);
      void apiBuyVoucher(getSupabase(), {
        place_id: placeId,
        voucher: key,
        request_id: crypto.randomUUID(),
        return_url: window.location.href,
      })
        .then((r) => {
          if (r.url) window.location.assign(r.url);
        })
        .catch((err: unknown) => {
          // MESITA-3549: an open Checkout resumes; place_cap keeps the offer.
          const action = err instanceof EFError ? buyRefusalAction(err.code, err.body) : buyRefusalAction(null, null);
          if (action.kind === "open") {
            window.location.assign(action.url);
            return;
          }
          setBuying(null);
          setChoosing(null);
          toast(action.line, { tone: "error" });
          if (action.reload) load();
        });
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeId, load],
  );

  const payWithCard = useCallback(
    async (key: VoucherKey, card: SavedCard) => {
      setBuying(key);
      const args = {
        place_id: placeId,
        voucher: key,
        request_id: crypto.randomUUID(),
        return_url: window.location.href,
        card_pm_id: card.id,
      };
      try {
        let r = await apiBuyVoucher(getSupabase(), args);
        if (r.card?.status === "requires_action") {
          if ((await runBankCheck(r.card)) === "unavailable") {
            toast("Couldn't open the bank check. Try again.", { tone: "error" });
          }
          // The same tap again: how the card payment ended.
          r = await apiBuyVoucher(getSupabase(), args);
        }
        setChoosing(null);
        if (r.card?.status === "succeeded") toast.success("Voucher bought. The credit is in your Wallet.");
        else if (r.card?.status === "processing") toast("Your bank is confirming the payment. The credit shows in your Wallet once it's through.");
        else toast("The bank check wasn't finished. Nothing was charged.", { tone: "error" });
      } catch (err: unknown) {
        const action = err instanceof EFError ? buyRefusalAction(err.code, err.body) : buyRefusalAction(null, null);
        setChoosing(null);
        toast(action.kind === "say" ? action.line : BUY_REFUSAL.in_progress, { tone: "error" });
      } finally {
        setBuying(null);
        load();
      }
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeId, load],
  );

  const addCard = useCallback(() => {
    void apiAddCard(getSupabase(), window.location.href)
      .then(({ url }) => window.location.assign(url))
      .catch((err: unknown) => {
        toast((err instanceof EFError && err.code && CARD_REFUSAL[err.code]) || CARD_REFUSAL.checkout_failed, { tone: "error" });
      });
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = state?.placeId === placeId ? state.money : null;
  const line = choosing ? money?.catalog[choosing] : undefined;
  const sheet = (
    <VoucherPaySheet
      open={choosing !== null}
      title={line && money ? `${moneyLabel(line.price_cents, money.currency)} voucher` : "Voucher"}
      cards={cards}
      busy={buying !== null}
      onCard={(card) => {
        if (choosing) void payWithCard(choosing, card);
      }}
      onCheckout={() => {
        if (choosing) checkout(choosing);
      }}
      onAddCard={addCard}
      onClose={() => setChoosing(null)}
    />
  );

  return {
    money,
    inWallet: card && card.placeId === placeId ? card.inWallet : undefined,
    addHouseCard,
    buying,
    loading: mesita && settled !== placeId,
    load,
    buy,
    sheet,
  };
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

"use client";

import { useRouter } from "next/navigation";
import { readCachedEntry, writeCached } from "@/lib/screen-cache";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  PayCard,
  PayCards,
  PlaceActions,
  PlaceMoney,
  RewardsSection,
  VoucherBasketItem,
  VoucherBuyOutcome,
  VoucherKey,
} from "@mesita/place-profile";
import { pickPayCard } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import {
  apiBuyVoucher,
  apiListVouchers,
  BUY_REFUSAL,
  buyRefusalAction,
  isDefinitiveRefusal,
} from "@/lib/api/wallet";
import { apiListCards, brandLabel } from "@/lib/api/cards";
import { isApplePhone, walletInBrowser } from "@/lib/pay-wallet";
import { runBankCheck } from "@/lib/api/tab";
import { useAddCardModal } from "@/lib/added-card";
import {
  isGoogleMapsUrl,
  MapsLeaveModal,
} from "@/components/consumer/MapsLeaveModal";
import { RemoveSavedDialog } from "@/components/consumer/RemoveSavedDialog";
import { PlaceSocialList } from "@/components/consumer/PlaceSocialList";
import {
  apiTrackActivity,
  isMesitaPlaceId,
} from "@/lib/api/activity";
import type { PlaceDetail } from "@/lib/place-detail";
import { useSavedPlaces } from "@/lib/saved-places";
import { sharePlace } from "@/lib/share-place";
import {
  useBrowserSupabase,
  useLazyBrowserSupabase,
} from "@/lib/supabase/browser";
import { locationSnapshot } from "@/lib/use-user-location";
import { navigateTo } from "@/lib/navigate";
import {
  placeContactPath,
  placeMenuPath,
  placeOffersPath,
  placeReservePath,
  placeUpgradePath,
  reservationPath,
} from "@/lib/consumer-route-contract";
import {
  apiListReservations,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { statusLabel, whenLine } from "@/lib/reservation-when";
import { toReservationItem } from "@/lib/reservations-adapter";
import { toast } from "@/lib/toast";
import { openSignGate } from "@/lib/anonymous";
import { useViewer } from "@/lib/identity-context";
import { trackEvent } from "@/lib/analytics/track";
import { dropBoughtOffers } from "@/lib/catalog-modes";

// One hook per member surface. Contact, Report, Upgrade and a menu file are
// pages (MESITA-4111); More is rows at the foot. The shared renderer stays
// presentational.
//
// Social v1 (MESITA-2442): opening the profile records `viewed`. No "You liked
// this" line: the heart alone says it (Pato, MESITA-4868). There is no
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

export function useMemberPlaceActions(place: PlaceDetail): {
  /** The place to draw: Enriching once a view found it mid-run. */
  place: PlaceDetail;
  /** The Wallet and reservation reads are in (MESITA-3803): draw the
   *  place's skeleton until then, so the profile paints in one frame. */
  ready: boolean;
  actions: PlaceActions;
  sheets: ReactNode;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const router = useRouter();
  // THE MODAL, NOT THE PAGE (Pato, 2026-11-18, MESITA-4325: "if i click
  // reservations ... offers ... display the fucking modal. don't open the
  // pages nor redirect"): signed out, Reserve, Offers and Pay ask to sign in
  // where the visitor stands, with the address they would have opened as
  // `next`. The link catcher in SignGateModal only sees <a> taps; these open
  // by navigateTo and local state.
  const signedOut = useViewer() === "anonymous";
  const askOr = (next: string, open: () => void) => () => {
    if (signedOut) openSignGate(next, null);
    else open();
  };
  const saved = isSaved(place.id);
  const activity = usePlaceActivity(place.id);
  // The place's offer and the guest's credit here, for the Wallet tile
  // (MESITA-3574). Buying happens on the Offers page (MESITA-4379).
  const vouchers = usePlaceVouchers(place.id);
  const reservation = usePlaceReservation(place.id);
  const live = reservation.row;
  // THE RESERVE TAP MOVES AT ONCE (MESITA-4443, Pato: "NAVIGATE
  // IMMEDIATELY, THEN PUT THE LOADING … DON'T AWAIT IN THE SAME PAGE"): the
  // Reserve tile is a button, not a Link, so nothing prefetched its page and
  // a tap painted nothing until the server answered. Prefetch it here: a
  // dynamic route prefetches only up to its loading.tsx (no page code, no
  // writes), so the tap paints the grey Reserve frame at once and the page
  // fills in behind it.
  const reservePath = placeReservePath(place.id);
  const contactPath = placeContactPath(place.id);
  const upgradePath = placeUpgradePath(place.id);
  useEffect(() => {
    // Contact is open to a signed-out visitor. The member pages prefetch
    // only once they can be opened (MESITA-4443: a dynamic route prefetches
    // its loading frame, so the tap paints at once).
    router.prefetch(contactPath);
    if (signedOut || !isMesitaPlaceId(place.id)) return;
    router.prefetch(reservePath);
    router.prefetch(upgradePath);
  }, [
    router,
    contactPath,
    reservePath,
    upgradePath,
    signedOut,
    place.id,
  ]);
  // A Checkout that still returns to the place (an in-flight session from
  // before Upgrade was a page) continues on the Upgrade page, refill intact.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("refill")) return;
    router.replace(`${upgradePath}?${params.toString()}`);
  }, [router, upgradePath]);
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
  // Back to a place this session already read paints at once from the kept
  // answers (MESITA-4379) while both reads run again behind it.
  const ready =
    !isMesitaPlaceId(place.id) ||
    readFor === place.id ||
    (vouchers.warm && reservation.warm);

  const openUpgrade = askOr(upgradePath, () =>
    navigateTo(router, upgradePath, { motion: "drill" }),
  );

  // REMOVING ASKS FIRST (MESITA-4676): an unsave waits for the confirm.
  const [askUnsave, setAskUnsave] = useState(false);
  const onSave = useCallback(() => {
    if (saved) {
      setAskUnsave(true);
      return;
    }
    toggle(place.id);
    toast.success(`Added ${place.name} to Saved`);
  }, [place.id, place.name, saved, toggle]);

  // A Google Maps link asks first (MESITA-4448): it waits here for the
  // modal's yes. Every other outside link opens as before.
  const [mapsAsk, setMapsAsk] = useState<string | null>(null);
  const onOpenLink = useCallback((url: string) => {
    if (url.startsWith("tel:")) {
      window.location.href = url;
      return;
    }
    if (isGoogleMapsUrl(url)) {
      setMapsAsk(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const actions: PlaceActions = {
    onSave,
    saved,
    onContact: () => navigateTo(router, contactPath, { motion: "drill" }),
    onShare: () => void sharePlace(place),
    // The full Reserve page (MESITA-3609), not a sheet.
    onReserve: askOr(placeReservePath(place.id), () =>
      navigateTo(router, placeReservePath(place.id), { motion: "drill" }),
    ),
    // The guest's one live table here (MESITA-3640), under the four tiles.
    reservation: live
      ? {
          when: whenLine(live.reserved_at, place.timezone || null),
          status: statusLabel(live),
          confirmed: toReservationItem(live).state === "confirmed",
          onOpen: () =>
            navigateTo(router, reservationPath(live.id), { motion: "drill" }),
        }
      : null,
    onBoost: openUpgrade,
    onOpenMenu: (item) => {
      const index = place.products.menu.findIndex(
        (m) => m.name === item.name && m.url === item.url,
      );
      if (index < 0) return;
      navigateTo(router, placeMenuPath(place.id, index), { motion: "drill" });
    },
    onOpenLink,
    // The Social tab (MESITA-3417): this place's activity; a Google-only
    // card has none, so it keeps the package's empty screen.
    ...(isMesitaPlaceId(place.id)
      ? { renderSocial: () => <PlaceSocialList placeId={place.id} /> }
      : {}),
    // OFFERS IS A PAGE (MESITA-4379): the Offers tile pushes
    // /place/<id>/offers, which slides in over the profile; Back uncovers
    // it. It was a full-screen sheet over this screen (MESITA-3412).
    onOpenRewards: (section: RewardsSection) => {
      const href = placeOffersPath(place.id, section);
      askOr(href, () => navigateTo(router, href, { motion: "drill" }))();
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
      <MapsLeaveModal
        url={mapsAsk}
        placeName={place.name ?? null}
        onClose={() => setMapsAsk(null)}
      />
      <RemoveSavedDialog
        name={askUnsave ? (place.name ?? "This place") : null}
        onConfirm={() => {
          setAskUnsave(false);
          if (saved) toggle(place.id);
          toast(`Removed ${place.name} from Saved`);
        }}
        onCancel={() => setAskUnsave(false)}
      />
    </>
  );

  return {
    place: shown,
    ready,
    actions,
    sheets,
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
const reservationKey = (placeId: string) => `place-reservation:${placeId}`;
const vouchersKey = (placeId: string) => `place-vouchers:${placeId}`;

function usePlaceReservation(placeId: string): {
  row: EFReservationRow | null;
  /** This session read it before: the kept answer is drawn at once. */
  warm: boolean;
  /** Reads it; resolves once it answered or failed (never rejects). */
  load: () => Promise<void>;
} {
  // The memoized client: the lazy getter is a new closure each render and
  // would refetch forever in an effect (MESITA-3207).
  const supabase = useBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  // KEPT FOR BACK (MESITA-4379): a page pushed over the place (Offers,
  // Reserve) unmounts it; Back draws the last answer at once and
  // reads again behind it, instead of the skeleton.
  const [found, setFound] = useState<{
    placeId: string;
    row: EFReservationRow | null;
  } | null>(() => {
    const kept = readCachedEntry<EFReservationRow | null>(
      reservationKey(placeId),
    );
    return kept ? { placeId, row: kept.value } : null;
  });
  const [warm] = useState(
    () => readCachedEntry(reservationKey(placeId)) !== null,
  );
  const load = useCallback(async () => {
    if (!mesita) return;
    const row = await apiListReservations(supabase, {
      scope: "upcoming",
      limit: 100,
    })
      .then(
        ({ reservations }) =>
          reservations.find((r) => r.place?.id === placeId) ?? null,
      )
      .catch(() => null);
    // Keyed by place: an answer for a place left behind is never drawn.
    setFound({ placeId, row });
    writeCached(reservationKey(placeId), row);
  }, [mesita, placeId, supabase]);
  return { row: found?.placeId === placeId ? found.row : null, warm, load };
}

export function usePlaceVouchers(
  placeId: string,
  /** `onPaid` runs when a card payment succeeded or is still processing, never
   *  on a declined, abandoned or failed attempt: the Loyalty Card reads the
   *  Wallet again from it (MESITA-3868). */
  opts: { onPaid?: () => void } = {},
): {
  money: PlaceMoney | null;
  /** This session read the offer before: the kept answer is drawn at once
   *  (MESITA-4379). */
  warm: boolean;
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
  buy: (
    items: VoucherBasketItem[],
    cardId: string | null,
  ) => Promise<VoucherBuyOutcome>;
  /** offer_sheet_opened (MESITA-4375). */
  opened: (voucher: VoucherKey, savedCard: boolean) => void;
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
  const [offer, setOffer] = useState<{
    placeId: string;
    money: PlaceMoney | null;
    failed: boolean;
  } | null>(() => {
    const kept = readCachedEntry<PlaceMoney | null>(vouchersKey(placeId));
    return kept ? { placeId, money: kept.value, failed: false } : null;
  });
  const [warm] = useState(() => readCachedEntry(vouchersKey(placeId)) !== null);
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
        writeCached(vouchersKey(placeId), money ?? null);
      })
      .catch(() => {
        if (mine !== request.current) return;
        // The offer already on screen stays; the read is marked failed.
        setOffer((prev) => ({
          placeId,
          money: prev?.placeId === placeId ? prev.money : null,
          failed: true,
        }));
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
    setPayCards((prev) =>
      prev?.state === "ready" ? prev : { state: "loading" },
    );
    try {
      const supabase = getSupabase();
      const [{ cards, pay_method }, session] = await Promise.all([
        apiListCards(supabase),
        supabase.auth.getSession(),
      ]);
      if (mine !== cardsRequest.current) return;
      userKey.current = session.data.session?.user.id ?? null;
      const list: PayCard[] = cards.map((c) => ({
        id: c.id,
        label: brandLabel(c.brand),
        last4: c.last4,
        exp_month: c.exp_month,
        exp_year: c.exp_year,
      }));
      // The card leads the pay box when it is the guest's default way to pay
      // (MESITA-4529): chosen as card, or a phone wallet this browser lacks.
      const cardFirst =
        pay_method === "card" ||
        ((pay_method === "apple_pay" || pay_method === "google_pay") && !walletInBrowser(pay_method, isApplePhone()));
      setPayCards({ state: "ready", cards: list, cardFirst });
      setPayCardId((prev) =>
        prev && list.some((c) => c.id === prev)
          ? prev
          : pickPayCard(list, readLastCard(userKey.current)),
      );
    } catch (err) {
      if (mine !== cardsRequest.current) return;
      // Signed out: no "Pay with"; Pay opens the card sheet, which says why.
      setPayCards(
        err instanceof EFError && err.code === "sign_in"
          ? undefined
          : { state: "error" },
      );
    }
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesita]);

  const selectCard = useCallback((id: string) => setPayCardId(id), []);
  const openAddCard = useAddCardModal((id) => {
    setPayCardId(id);
    writeLastCard(userKey.current, id);
    toast.success("Card saved. Tap Pay to buy.");
    void loadCards();
  });

  // ONE request_id PER BASKET AND CARD (MESITA-4065): kept across every retry
  // after an unknown outcome (no answer, a 5xx, card_failed), so the server
  // finds the same purchase and never charges twice; dropped on a definitive
  // answer. Three unknown outcomes in a row stop with "check Wallet".
  const pending = useRef<{
    key: string;
    requestId: string;
    unknown: number;
  } | null>(null);

  const buy = useCallback(
    async (
      what: VoucherBasketItem[],
      cardId: string | null,
    ): Promise<VoucherBuyOutcome> => {
      if (!mesita) return "failed";
      const items = what.filter((i) => i.qty > 0);
      if (items.length === 0) return "failed";
      if (!cardId) {
        openAddCard();
        return "failed";
      }
      const key = `${cardId}|${items.map((i) => `${i.voucher}x${i.qty}`).join(",")}`;
      // A CHANGED BASKET NEVER OPENS A SECOND CHARGE (MESITA-4647): the shop's
      // steppers can change the basket after an unknown outcome, and a new
      // key is a new request_id the server can't match. Until the last one
      // answers, only the same basket on the same card may pay.
      if (pending.current && pending.current.key !== key && pending.current.unknown > 0) {
        toast(BUY_REFUSAL.unconfirmedChanged, { tone: "error" });
        return "failed";
      }
      if (pending.current?.key !== key)
        pending.current = { key, requestId: crypto.randomUUID(), unknown: 0 };
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
      } as Parameters<typeof apiBuyVoucher>[1];
      try {
        let r = await apiBuyVoucher(getSupabase(), args);
        if (r.card.status === "requires_action") {
          if ((await runBankCheck(r.card)) === "unavailable") {
            toast("Couldn't open the bank check. Try again.", {
              tone: "error",
            });
          }
          // The same purchase again: how the card payment ended.
          r = await apiBuyVoucher(getSupabase(), args);
        }
        if (r.card.status === "succeeded" || r.card.status === "processing") {
          pending.current = null;
          writeLastCard(userKey.current, cardId);
          // The funnel's paid side (MESITA-4375): every voucher of the basket.
          trackEvent(getSupabase(), "voucher_paid", {
            place_id: placeId,
            items,
            method: "saved_card",
            status: r.card.status,
          });
          dropBoughtOffers(
            placeId,
            items.map((i) => i.voucher),
          );
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
        const action = buyRefusalAction(code);
        if (action.kind === "add_card") openAddCard();
        if (action.kind === "reload_cards") void loadCards();
        const line =
          !isDefinitiveRefusal(status, code) &&
          pending.current &&
          pending.current.unknown >= 3
            ? BUY_REFUSAL.unconfirmed
            : action.line;
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

  const opened = useCallback(
    (voucher: VoucherKey, savedCard: boolean) => {
      if (mesita)
        trackEvent(getSupabase(), "offer_sheet_opened", {
          place_id: placeId,
          voucher,
          saved_card: savedCard,
        });
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesita, placeId],
  );

  const mine = offer?.placeId === placeId ? offer : null;
  const money = mine?.money ?? null;
  // Add a card: a modal since MESITA-4398 (a page in MESITA-4101); then
  // here the new card is the selected one. The basket is not kept, so the
  // guest taps Pay again.
  const sheet = null;

  return {
    money,
    warm,
    failed: mine?.failed === true,
    buying,
    loading: mesita && mine === null,
    load,
    buy: (items, cardId) => buy(items, cardId),
    opened,
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

function usePlaceActivity(placeId: string): {
  enriching: boolean;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  // The place this page's view found mid-Enrich (MESITA-2952).
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  useEffect(() => {
    if (!mesita) return;
    let cancelled = false;
    const supabase = getSupabase();
    // Where the view happened (MESITA-2853): the device fix, if any.
    void apiTrackActivity(supabase, {
      kind: "viewed",
      placeId,
      at: locationSnapshot().coords,
    })
      .then((tracked) => {
        if (!cancelled && tracked.enriching) setEnrichingId(placeId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, mesita]);

  return {
    enriching: mesita && enrichingId === placeId,
  };
}

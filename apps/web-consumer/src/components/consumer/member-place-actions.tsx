"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { readCached, writeCached } from "@/lib/screen-cache";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { PlaceActions, PlaceMenuItem, PlaceMoney, RewardsSection, VoucherKey } from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import { apiBuyVoucher, apiListVouchers, buyRefusalAction } from "@/lib/api/wallet";
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
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot } from "@/lib/use-user-location";
import { navigateTo } from "@/lib/navigate";
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
  actions: PlaceActions;
  sheets: ReactNode;
  social: ReactNode;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const router = useRouter();
  const profile = useConsumerProfile().data;
  const saved = isSaved(place.id);
  const [contactOpen, setContactOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
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
  // The Wallet tile's credit (MESITA-3574): read the place's offer and the
  // guest's balance when the screen opens, not only when Rewards opens.
  // load sets state in its promise callbacks only (Next 16 lint).
  const loadVouchers = vouchers.load;
  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);
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
    onReserve: () => setReserveOpen(true),
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
    // The Rewards sheet (MESITA-3303): Buy opens Stripe Checkout on the
    // place's account; opening the sheet refreshes the offer and the credit.
    onBuyVoucher: vouchers.buy,
    buyingVoucher: vouchers.buying,
    onLoadVouchers: vouchers.load,
    vouchersLoading: vouchers.loading,
    // The Cashback card's Pay (MESITA-3352): the bar's Pay page; the sheet
    // closes on the way out.
    onPay: () => {
      setRewards(null);
      setAskDismissed(true);
      navigateTo(router, "/pay");
    },
    // The pinned row's Wallet tile (MESITA-3574): the Wallet, opened at this
    // place's credit; its pill reads the list-vouchers balance below.
    onOpenWallet: () => navigateTo(router, `/wallet?place=${encodeURIComponent(place.id)}`),
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
      navigateTo(router, "/me/class");
    },
    onLinkInstagram: () => {
      setRewards(null);
      navigateTo(router, "/me/instagram");
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
      <ReservationSheet
        place={place}
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
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
    </>
  );

  return {
    place: shown,
    actions,
    sheets,
    social: activity.social,
  };
}

// Vouchers (MESITA-3303): the tab's fresh offer and the one buy. The place
// read carried an offer already; the tab asks again because the screen
// may be served from the store and the guest's credit changes. Buy opens
// Stripe Checkout on the place's own account; a refusal says the server's
// line and refreshes the offer so the tab shows why.
function usePlaceVouchers(placeId: string): {
  money: PlaceMoney | null;
  buying: VoucherKey | null;
  /** The first list-vouchers for this place has not answered (MESITA-3388). */
  loading: boolean;
  load: () => void;
  buy: (key: VoucherKey) => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{ placeId: string; money: PlaceMoney } | null>(null);
  const [buying, setBuying] = useState<VoucherKey | null>(null);
  // The place whose list-vouchers answered, either way; set only in the
  // promise callbacks, never synchronously in an effect (Next 16 lint).
  const [settled, setSettled] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!mesita) return;
    void apiListVouchers(getSupabase(), placeId)
      .then((money) => {
        if (money) setState({ placeId, money });
      })
      .catch(() => {
        // The place read's offer stays on screen.
      })
      .finally(() => setSettled(placeId));
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesita, placeId]);

  const buy = useCallback(
    (key: VoucherKey) => {
      if (!mesita) return;
      setBuying(key);
      void apiBuyVoucher(getSupabase(), {
        place_id: placeId,
        voucher: key,
        request_id: crypto.randomUUID(),
        return_url: window.location.href,
      })
        .then((r) => {
          window.location.assign(r.url);
        })
        .catch((err: unknown) => {
          // MESITA-3549: an open Checkout resumes; place_cap keeps the offer.
          const action = err instanceof EFError ? buyRefusalAction(err.code, err.body) : buyRefusalAction(null, null);
          if (action.kind === "open") {
            window.location.assign(action.url);
            return;
          }
          setBuying(null);
          toast(action.line, { tone: "error" });
          if (action.reload) load();
        });
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesita, placeId, load],
  );

  return {
    money: state?.placeId === placeId ? state.money : null,
    buying,
    loading: mesita && settled !== placeId,
    load,
    buy,
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

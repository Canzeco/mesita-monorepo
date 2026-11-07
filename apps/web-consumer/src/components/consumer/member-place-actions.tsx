"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { readCached, writeCached } from "@/lib/screen-cache";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { PlaceActions, PlaceMenuItem, PlaceMoney, VoucherKey } from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import { apiBuyVoucher, apiListVouchers, BUY_REFUSAL } from "@/lib/api/wallet";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
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
export function useMemberPlaceActions(place: PlaceDetail): {
  /** The place to draw: Enriching once a view found it mid-run. */
  place: PlaceDetail;
  actions: PlaceActions;
  sheets: ReactNode;
  social: ReactNode;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const router = useRouter();
  const saved = isSaved(place.id);
  const [contactOpen, setContactOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // When the Upgrade tile or ⋯ › Upgrade last asked for the Upgrade sheet (ms).
  const [boostAskedAt, setBoostAskedAt] = useState(0);
  const [boostClosedAt, setBoostClosedAt] = useState(0);
  const onBoost = () => setBoostAskedAt(Date.now());
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const activity = usePlaceActivity(place.id);
  const boost = usePlaceBoost(place.id);
  const vouchers = usePlaceVouchers(place.id);
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
    // The Vouchers tab (MESITA-3303): Buy opens Stripe Checkout on the
    // place's account; opening the tab refreshes the offer and the credit.
    onBuyVoucher: vouchers.buy,
    buyingVoucher: vouchers.buying,
    onLoadVouchers: vouchers.load,
    // The Cashback card's Pay (MESITA-3352): the bar's Pay page.
    onPay: () => navigateTo(router, "/pay"),
  };

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
  load: () => void;
  buy: (key: VoucherKey) => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{ placeId: string; money: PlaceMoney } | null>(null);
  const [buying, setBuying] = useState<VoucherKey | null>(null);

  const load = useCallback(() => {
    if (!mesita) return;
    void apiListVouchers(getSupabase(), placeId)
      .then((money) => {
        if (money) setState({ placeId, money });
      })
      .catch(() => {
        // The place read's offer stays on screen.
      });
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
          setBuying(null);
          const code = err instanceof EFError ? err.code : null;
          toast((code && BUY_REFUSAL[code]) || BUY_REFUSAL.checkout_failed, { tone: "error" });
          load();
        });
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesita, placeId, load],
  );

  return {
    money: state?.placeId === placeId ? state.money : null,
    buying,
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

"use client";

import dynamic from "next/dynamic";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { readCached, writeCached } from "@/lib/screen-cache";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  PlaceActions,
  PlaceMenuItem,
  PlaceTab,
} from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import {
  BoostPane,
  BoostUnavailable,
} from "@/components/consumer/place-detail/BoostPane";
import {
  apiPlaceActivity,
  apiTrackActivity,
  isMesitaPlaceId,
  type PlaceActivity,
} from "@/lib/api/activity";
import {
  apiGetBoost,
  tierLabel,
  shortDate,
  type PlaceBoost,
} from "@/lib/api/boost";
import type { PlaceDetail } from "@/lib/place-detail";
import { useSavedPlaces } from "@/lib/saved-places";
import { sharePlace } from "@/lib/share-place";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot } from "@/lib/use-user-location";
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

// One hook per member surface so the body and the Reserve bar share the
// sheets. The shared renderer stays presentational.
//
// Social v1 (MESITA-2442): opening the profile records `viewed`; the line
// under the title comes from consumer-web-list-activity. There is no
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
  /** The Premier tab's body (MESITA-2861, MESITA-2925). */
  boost: ReactNode;
  /** Set when ⋯ › Premier or Stripe Checkout's return asks for the
   *  Premier tab (MESITA-2797, MESITA-2861). */
  openTab: { tab: PlaceTab; key: number } | null;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(place.id);
  const [contactOpen, setContactOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // When ⋯ › Premier last asked for the Premier tab (ms).
  const [boostAskedAt, setBoostAskedAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const activity = usePlaceActivity(place.id);
  const boost = usePlaceBoost(place.id);
  // ⋯ › Premier and Stripe Checkout's return both open the Premier tab; the
  // later ask wins, and each new key switches once (PlaceDetailBody).
  const boostAsk = Math.max(boostAskedAt ?? 0, boost.returnedAt ?? 0);
  const openTab =
    boostAsk > 0 ? { tab: "boost" as const, key: boostAsk } : null;

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
    onOpenMenu: (item) => setMenu(item),
    onOpenLink,
  };

  // A Google-only card is not a place row yet: nothing to back. It says so
  // in the consumer's own words (MESITA-2797), never the package's
  // "from the Mesita app" line, which reads wrong inside the app.
  const boostPane = isMesitaPlaceId(place.id) ? (
    <BoostPane
      place={place}
      boost={boost.data}
      loading={boost.loading}
      failed={boost.failed}
      onRetry={boost.reload}
      onChanged={boost.reload}
    />
  ) : (
    <BoostUnavailable />
  );

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
      <PlaceMoreSheet
        place={place}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        saved={saved}
        onSave={onSave}
        onBoost={() => setBoostAskedAt(Date.now())}
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
  return {
    place: enriching ? { ...place, is_enriching: true } : place,
    actions,
    sheets,
    social: activity.social,
    boost: boostPane,
    openTab,
  };
}

// Premier (MESITA-2995): the place's period, its line, and the guest's own
// pledge. Checkout returns with `?boost=<session>`: settle it, say what
// happened only from the server's outcome, and drop the parameter so a
// reload does not settle twice.
function sayCheckoutOutcome(data: PlaceBoost) {
  const p = data.period;
  const label = p ? tierLabel(p.tier) : "Premier";
  switch (data.outcome) {
    case "confirmed":
      toast.success(
        p
          ? `You're paying for ${label}. Renews ${shortDate(p.ends_at)}.`
          : "You're paying for Premier.",
      );
      return;
    case "saved_as_backup":
      toast.success(`You're Backup ${data.mine?.position || 1}.`);
      return;
    case "released_stale":
      toast(
        `Someone changed the line while you were paying. We released the hold on your card. You're Backup ${data.mine?.position || 1}.`,
      );
      return;
    case "expired":
      toast("Checkout cancelled. Nothing was charged.");
      return;
    default:
      toast("Confirming your payment…");
  }
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
    const session = params.get("boost") ?? undefined;
    if (session) {
      params.delete("boost");
      const q = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${q ? `?${q}` : ""}`,
      );
    }
    void apiGetBoost(getSupabase(), placeId, session)
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

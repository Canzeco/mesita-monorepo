"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  PlaceActions,
  PlaceMenuItem,
  PlaceTab,
} from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { MenuViewer } from "@/components/consumer/MenuViewer";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import { PlaceMoreSheet } from "@/components/consumer/place-detail/PlaceMoreSheet";
import { ReportSheet } from "@/components/consumer/place-detail/ReportSheet";
import { BoostPane, BoostUnavailable } from "@/components/consumer/place-detail/BoostPane";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
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
import { toast } from "@/lib/toast";

// One hook per member surface so the body and the Reserve bar share the
// sheets. The shared renderer stays presentational.
//
// Social v1 (MESITA-2442): opening the profile records `viewed`; the line
// under the title comes from consumer-web-list-activity. There is no
// "I went" (MESITA-2567: Social is liked and viewed only).
export function useMemberPlaceActions(place: PlaceDetail): {
  actions: PlaceActions;
  sheets: ReactNode;
  social: ReactNode;
  /** The Boost tab's body (MESITA-2789). */
  boost: ReactNode;
  /** Set when Stripe Checkout sends the guest back: open the Boost tab
   *  (MESITA-2797). */
  openTab: { tab: PlaceTab; key: number } | null;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(place.id);
  const [contactOpen, setContactOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const activity = usePlaceActivity(place.id);
  const boost = usePlaceBoost(place.id);

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

  return {
    actions,
    sheets,
    social: activity.social,
    boost: boostPane,
    openTab: boost.returnedAt != null ? { tab: "boost", key: boost.returnedAt } : null,
  };
}

// Boost (MESITA-2789): the place's tier and backers, and the guest's own
// backings. Checkout returns with `?boost=<session>`: confirm it, say so
// only when Stripe confirmed it, and drop the parameter so a reload does
// not confirm twice.
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
  }>({ placeId, nonce: -1, data: null, failed: false });
  const [nonce, setNonce] = useState(0);
  const [returned, setReturned] = useState<{ placeId: string; at: number } | null>(null);

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
        if (session) setReturned({ placeId, at: Date.now() });
        if (session && data.confirmed) toast.success("Your Boost is on. Thanks for backing this place");
        else if (session) toast("We're confirming your payment with Stripe. Your Boost shows once it clears.");
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ placeId, nonce, data: s.placeId === placeId ? s.data : null, failed: true }));
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
    loading: mesita && (!fresh || state.nonce !== nonce),
    failed: mesita && fresh && state.failed,
    returnedAt: mesita && returned?.placeId === placeId ? returned.at : null,
    reload: () => setNonce((n) => n + 1),
  };
}

function usePlaceActivity(placeId: string): { social: ReactNode } {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{
    placeId: string;
    activity: PlaceActivity | null;
  }>({ placeId, activity: null });

  useEffect(() => {
    if (!mesita) return;
    let cancelled = false;
    const supabase = getSupabase();
    // Viewed first, so the guest's own open counts in the line it reads.
    void apiTrackActivity(supabase, { kind: "viewed", placeId })
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
  return { social: mesita ? social : null };
}


"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  PlaceActions,
  PlaceMenuItem,
  PlaceRequestView,
} from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { MenuViewer } from "@/components/consumer/MenuViewer";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { apiRequestPlace } from "@/lib/api/places";
import {
  apiPlaceActivity,
  apiTrackActivity,
  isMesitaPlaceId,
  type PlaceActivity,
} from "@/lib/api/activity";
import type { PlaceDetail } from "@/lib/place-detail";
import { useSavedPlaces } from "@/lib/saved-places";
import { sharePlace } from "@/lib/share-place";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";

// One hook per member surface so the body and the Reserve bar share the
// sheets. The shared renderer stays presentational.
//
// Social v1 (MESITA-2442): opening the profile records `viewed`; the line
// under the title and the guest's own "I went" come from
// consumer-web-list-activity; "I went" writes `went` on and off.
export function useMemberPlaceActions(place: PlaceDetail): {
  actions: PlaceActions;
  sheets: ReactNode;
  social: ReactNode;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(place.id);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const request = usePlaceRequest(place);
  const activity = usePlaceActivity(place.id);

  const onSave = useCallback(() => {
    const nowSaved = !saved;
    toggle(place.id);
    if (nowSaved) toast.success(`Saved ${place.name}`);
    else toast(`Removed ${place.name} from saved`);
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
    onWent: activity.onWent,
    went: activity.went,
    onShare: () => void sharePlace(place),
    onReserve: () => setReserveOpen(true),
    onRequest: request.onRequest,
    onOpenMenu: (item) => setMenu(item),
    onOpenLink,
    request: request.view,
  };

  const sheets = (
    <>
      <ReservationSheet
        place={place}
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
      />
      <MenuViewer
        open={menu != null}
        onClose={() => setMenu(null)}
        menu={menu}
      />
    </>
  );

  return { actions, sheets, social: activity.social };
}

function usePlaceActivity(placeId: string): {
  social: ReactNode;
  went: boolean;
  onWent?: () => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{
    placeId: string;
    activity: PlaceActivity | null;
  }>({ placeId, activity: null });
  const [wentOverride, setWentOverride] = useState<{
    placeId: string;
    went: boolean;
  } | null>(null);

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
  const went =
    wentOverride?.placeId === placeId
      ? wentOverride.went
      : (activity?.me.went ?? false);

  const onWent = useCallback(() => {
    const next = !went;
    setWentOverride({ placeId, went: next });
    if (next) toast.success("Marked as went");
    void apiTrackActivity(getSupabase(), {
      kind: "went",
      placeId,
      on: next,
    }).catch((e) => {
      setWentOverride({ placeId, went: !next });
      toast.error(errMsg(e, "Could not save that."));
    });
  }, [getSupabase, placeId, went]);

  const social = activity?.line ? (
    <SocialLine faces={activity.people} text={activity.line} />
  ) : null;

  // A Google-only card has no place row yet: no line, and "I went" stays
  // inert until the profile is created.
  return mesita ? { social, went, onWent } : { social: null, went: false };
}

function usePlaceRequest(place: PlaceDetail): {
  view: PlaceRequestView;
  onRequest: () => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const [count, setCount] = useState(place.request_count);
  const [requested, setRequested] = useState(place.requested);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRequest = useCallback(() => {
    if (pending || requested || place.is_enriching) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const supabase = await getSupabase();
        const result = await apiRequestPlace(supabase, place.id);
        setCount(result.request_count);
        setRequested(result.requested);
      } catch (e) {
        setError(errMsg(e, "Could not send the vote."));
      } finally {
        setPending(false);
      }
    })();
  }, [getSupabase, pending, place.id, place.is_enriching, requested]);

  return {
    view: {
      count,
      threshold: place.request_threshold,
      requested,
      enriching: place.is_enriching,
      pending,
      error,
    },
    onRequest,
  };
}

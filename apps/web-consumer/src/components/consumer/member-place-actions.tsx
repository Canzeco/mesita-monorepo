"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  PlaceActions,
  PlaceMenuItem,
} from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { MenuViewer } from "@/components/consumer/MenuViewer";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
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
} {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(place.id);
  const [contactOpen, setContactOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const activity = usePlaceActivity(place.id);

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
      <MenuViewer
        open={menu != null}
        onClose={() => setMenu(null)}
        menu={menu}
      />
    </>
  );

  return { actions, sheets, social: activity.social };
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


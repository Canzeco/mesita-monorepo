"use client";

import { useCallback, useState, type ReactNode } from "react";
import type {
  PlaceActions,
  PlaceMenuItem,
  PlaceRequestView,
} from "@mesita/place-profile";
import { MenuViewer } from "@/components/consumer/MenuViewer";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { apiRequestPlace } from "@/lib/api/places";
import type { PlaceDetail } from "@/lib/place-detail";
import { useSavedPlaces } from "@/lib/saved-places";
import { sharePlace } from "@/lib/share-place";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";

// One hook per member surface so the body and the Reserve bar share the
// sheets. The shared renderer stays presentational.
export function useMemberPlaceActions(place: PlaceDetail): {
  actions: PlaceActions;
  sheets: ReactNode;
} {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(place.id);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const request = usePlaceRequest(place);

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

  return { actions, sheets };
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

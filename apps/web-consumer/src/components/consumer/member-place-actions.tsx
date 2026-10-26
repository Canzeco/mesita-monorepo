"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type {
  PlaceActions,
  PlaceMenuItem,
} from "@mesita/place-profile";
import { SocialLine } from "@mesita/place-profile";
import { MenuViewer } from "@/components/consumer/MenuViewer";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import { PlaceMoreSheet } from "@/components/consumer/place-detail/PlaceMoreSheet";
import { ReportSheet } from "@/components/consumer/place-detail/ReportSheet";
import { backedBy, SpotlightSheet } from "@/components/consumer/place-detail/SpotlightSheet";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import {
  apiPlaceActivity,
  apiTrackActivity,
  isMesitaPlaceId,
  type PlaceActivity,
} from "@/lib/api/activity";
import { apiGetSpotlight, SPOTLIGHT_TIER_LABEL, type PlaceSpotlight } from "@/lib/api/spotlight";
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [menu, setMenu] = useState<PlaceMenuItem | null>(null);
  const activity = usePlaceActivity(place.id);
  const spotlight = usePlaceSpotlight(place.id);

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
        // A Google-only card is not a place row yet: nothing to back.
        onSpotlight={
          isMesitaPlaceId(place.id) ? () => setSpotlightOpen(true) : undefined
        }
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
      <SpotlightSheet
        place={place}
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        spotlight={spotlight.data}
        onChanged={spotlight.reload}
      />
      <MenuViewer
        open={menu != null}
        onClose={() => setMenu(null)}
        menu={menu}
      />
    </>
  );

  // The Spotlight line rides the social slot, above the activity line, and
  // opens the sheet.
  const tierLabel = spotlight.data ? SPOTLIGHT_TIER_LABEL[spotlight.data.tier] : null;
  const spotlightLine = tierLabel && spotlight.data ? (
    <button
      type="button"
      onClick={() => setSpotlightOpen(true)}
      className="text-foreground flex items-center gap-2 pt-1 text-left text-sm"
    >
      <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--brand-pink)" }} aria-hidden />
      <span>
        <span className="font-semibold">{tierLabel}</span>
        <span className="text-muted-foreground"> · backed by {backedBy(spotlight.data)}</span>
      </span>
    </button>
  ) : null;
  const social =
    spotlightLine || activity.social ? (
      <>
        {spotlightLine}
        {activity.social}
      </>
    ) : null;

  return { actions, sheets, social };
}

// Spotlight (MESITA-1998): the place's tier and backers, and the guest's own
// backings. Checkout returns with `?spotlight=<session>`: confirm it, say
// so, and drop the parameter so a reload does not confirm twice.
function usePlaceSpotlight(placeId: string): {
  data: PlaceSpotlight | null;
  reload: () => void;
} {
  const getSupabase = useLazyBrowserSupabase();
  const mesita = isMesitaPlaceId(placeId);
  const [state, setState] = useState<{
    placeId: string;
    data: PlaceSpotlight | null;
  }>({ placeId, data: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!mesita) return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const session = params.get("spotlight") ?? undefined;
    if (session) {
      params.delete("spotlight");
      const q = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${q ? `?${q}` : ""}`,
      );
    }
    void apiGetSpotlight(getSupabase(), placeId, session)
      .then((data) => {
        if (cancelled) return;
        setState({ placeId, data });
        if (session && data.confirmed) toast.success("Thanks for backing this place");
        else if (session) toast("Payment received. Your Spotlight will show shortly.");
      })
      .catch(() => {
        /* no line is the empty state */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, mesita, nonce]);

  const data = mesita && state.placeId === placeId ? state.data : null;
  return { data, reload: () => setNonce((n) => n + 1) };
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


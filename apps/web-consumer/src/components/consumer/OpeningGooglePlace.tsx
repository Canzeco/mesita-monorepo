"use client";

// The opening screen (MESITA-2311, MESITA-2307): a Google-only place the
// guest tapped, on screen at once as its profile. The card the guest tapped
// is the profile's first draft (the stash `useOpenGooglePlace` left); Google's
// photo lands when the client has it; a Creating fact leads the facts row,
// before the category (MESITA-2679), while get-or-create runs; when it
// lands, the Feed underneath reloads and this route is replaced by the real
// profile. A refusal keeps
// Google's profile on screen and says why, with Try again. It creates from
// a client effect only, after a deliberate tap navigated here: never on the
// server, never on a prefetch. No vote, no Save, no Reserve until the place
// is on Mesita.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { PlaceDetailBody, PlaceProfile } from "@mesita/place-profile";
import { PlaceDetailModalShell } from "@/components/consumer/PlaceDetailModalShell";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  fetchGooglePlaceFacts,
  type GooglePlaceFacts,
  NO_GOOGLE_PLACE_FACTS,
  type PlacesLibraryLike,
} from "@/lib/google-place-photo";
import {
  clearPendingPlace,
  parsePendingPlace,
  pendingPlaceDetail,
  readPendingPlaceRaw,
} from "@/lib/pending-place";
import { emitPlaceCreated } from "@/lib/place-created-event";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { getOrCreateGooglePlace } from "@/lib/use-open-google-place";
import { useMeasuredPlace } from "@/lib/place-distance";
import { errMsg } from "@/lib/utils";

type Variant = "modal" | "page";

export function OpeningGooglePlace({
  gid,
  name,
  apiKey,
  variant,
}: {
  gid: string;
  /** The name the tap sent along; the stashed card's name wins when present. */
  name: string;
  /** The browser Maps key; empty means no Google photo, the create still runs. */
  apiKey: string;
  /** "modal" inside the place slide-over, "page" on a hard load. */
  variant: Variant;
}) {
  // One APIProvider per screen: the Feed has no map, so nothing else loads
  // Maps JS there; on Search the loader is a singleton and this is a no-op.
  if (!apiKey) {
    return <OpeningBody gid={gid} name={name} variant={variant} places={null} />;
  }
  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      <OpeningWithMaps gid={gid} name={name} variant={variant} />
    </APIProvider>
  );
}

function OpeningWithMaps({
  gid,
  name,
  variant,
}: {
  gid: string;
  name: string;
  variant: Variant;
}) {
  const places = useMapsLibrary("places");
  return (
    <OpeningBody
      gid={gid}
      name={name}
      variant={variant}
      places={places as unknown as PlacesLibraryLike | null}
    />
  );
}

const subscribeNever = () => () => {};

function OpeningBody({
  gid,
  name,
  variant,
  places,
}: {
  gid: string;
  name: string;
  variant: Variant;
  places: PlacesLibraryLike | null;
}) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  // The card the guest tapped. The server snapshot is empty so the first
  // client paint agrees with it; the stash fills the draft right after.
  const raw = useSyncExternalStore(
    subscribeNever,
    () => readPendingPlaceRaw(gid),
    () => null,
  );
  const card = useMemo(() => parsePendingPlace(raw), [raw]);
  const [facts, setFacts] = useState<GooglePlaceFacts>(NO_GOOGLE_PLACE_FACTS);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Google's photo (and the name and address for a deep link with no
  // card): one Details call, only now that the guest opened the profile.
  useEffect(() => {
    if (!places) return;
    let live = true;
    void (async () => {
      try {
        const got = await fetchGooglePlaceFacts(places, gid);
        if (live) setFacts(got);
      } catch (err) {
        console.error("[opening-place] google facts:", err);
      }
    })();
    return () => {
      live = false;
    };
  }, [gid, places]);

  // The create, awaited: one shared request per Google Place ID. Landed, the
  // Feed underneath reloads its rails and this route becomes the real
  // profile (mirrored photo, Google stars).
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const opened = await getOrCreateGooglePlace(supabase, gid);
        clearPendingPlace(gid);
        emitPlaceCreated({ googlePlaceId: gid, href: opened.href, created: opened.created });
        if (!live) return;
        if (opened.created) {
          toast.success(`${card?.name ?? name ?? "This place"} is on Mesita. Vote to enrich its profile.`);
        }
        // The slide-over replaces itself in place. A hard-loaded page must
        // load the real profile as a page: a soft replace from here lets the
        // (.)place intercept paint the profile as a modal over this screen,
        // with no history entry for its Back to pop.
        if (variant === "page") window.location.replace(opened.href);
        else router.replace(opened.href);
      } catch (err) {
        if (live) setError(errMsg(err, "Couldn't open that place right now."));
      }
    })();
    return () => {
      live = false;
    };
    // The draft's name only decorates the toast; a retry is `attempt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, router, supabase, variant, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const pending = useMemo(
    () => pendingPlaceDetail(gid, card, name, facts),
    [gid, card, name, facts],
  );
  // The distance after the zone (MESITA-2644).
  const place = useMeasuredPlace(pending);
  const creating = useMemo(() => ({ error, onRetry: retry }), [error, retry]);
  const onBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(CONSUMER_ROUTES.home);
  }, [router]);

  if (variant === "modal") {
    return (
      <PlaceDetailModalShell place={place}>
        <PlaceDetailBody place={place} creating={creating} />
      </PlaceDetailModalShell>
    );
  }
  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
      <style>{`nav[data-shell-nav]{display:none}`}</style>
      <PlaceProfile place={place} onBack={onBack} creating={creating} />
    </div>
  );
}

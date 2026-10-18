"use client";

// A Google-only card's profile, on screen before Mesita holds the place
// (MESITA-2307). The route is /place/g:<googlePlaceId>. The card the guest
// tapped is the profile's first draft; Google's photo lands when the client
// has it; the Enrich slot says "Creating profile" while
// consumer-web-create-place (get-or-create) runs; when it lands, the Feed
// underneath reloads and the URL is replaced with the real profile. A
// refusal keeps Google's profile on screen and says why. No vote, no Save,
// no Reserve until the place is on Mesita.

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
import { apiCreateProject } from "@/lib/api/place-search";
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
import { placeHref } from "@/lib/place-route";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { errMsg } from "@/lib/utils";

type Variant = "page" | "modal";

export function PendingPlaceScreen({
  gid,
  apiKey,
  variant,
}: {
  gid: string;
  apiKey: string;
  variant: Variant;
}) {
  // One APIProvider per screen: the Feed has no map, so nothing else loads
  // Maps JS there; on Search the loader is a singleton and this is a no-op.
  // No key: the first draft keeps the initial placeholder, the create
  // still runs.
  if (!apiKey) return <PendingPlaceBody gid={gid} variant={variant} places={null} />;
  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      <PendingPlaceWithMaps gid={gid} variant={variant} />
    </APIProvider>
  );
}

function PendingPlaceWithMaps({ gid, variant }: { gid: string; variant: Variant }) {
  const places = useMapsLibrary("places");
  return (
    <PendingPlaceBody
      gid={gid}
      variant={variant}
      places={places as unknown as PlacesLibraryLike | null}
    />
  );
}

const subscribeNever = () => () => {};

function PendingPlaceBody({
  gid,
  variant,
  places,
}: {
  gid: string;
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

  // Google's photo (and the name and address for a deep link with no
  // card): one Details call, only now that the guest opened the profile.
  useEffect(() => {
    if (!places) return;
    let cancelled = false;
    void (async () => {
      try {
        const got = await fetchGooglePlaceFacts(places, gid);
        if (!cancelled) setFacts(got);
      } catch (err) {
        console.error("[pending-place] google facts:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gid, places]);

  // The create, awaited. Landed: the Feed underneath reloads its rails and
  // the URL becomes the real profile (mirrored photo, Google stars). A
  // second mount of the same id is a get, so a repeat costs nothing.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const opened = await apiCreateProject(supabase, { placeId: gid });
        const dest = opened.place.slug || opened.place.id;
        clearPendingPlace(gid);
        emitPlaceCreated({
          googlePlaceId: gid,
          id: opened.place.id,
          slug: opened.place.slug,
          created: opened.created !== false,
        });
        if (!cancelled && dest) router.replace(placeHref(dest));
      } catch (err) {
        if (!cancelled) {
          setError(errMsg(err, "Couldn't create this profile right now."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gid, router, supabase]);

  const place = useMemo(() => pendingPlaceDetail(gid, card, facts), [
    gid,
    card,
    facts,
  ]);
  const creating = useMemo(() => ({ error }), [error]);
  const onBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(CONSUMER_ROUTES.discoverDefault);
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

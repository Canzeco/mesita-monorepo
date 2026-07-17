"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APIProvider,
  APILoadingStatus,
  Map,
  Marker,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import type { Place } from "@/lib/api/places";
import { placeHref } from "@/lib/place-route";
import {
  MONTERREY_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_USER_ZOOM,
  MAP_MINIMAL_STYLES,
  MAP_CIRCLE_PATH,
  MAP_PARTNER_PIN_COLOR,
  MAP_WEB_PIN_COLOR,
} from "@/lib/map-defaults";
import {
  MapChromeHeader,
  MapLoadingVeil,
  PlacePreview,
  RecentreButton,
  SetupCard,
} from "./map-chrome";

function placeIcon(isPartner: boolean) {
  return {
    path: MAP_CIRCLE_PATH,
    fillColor: isPartner ? MAP_PARTNER_PIN_COLOR : MAP_WEB_PIN_COLOR,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2.5,
    scale: 1,
  };
}

const USER_ICON = {
  path: "M -6 0 A 6 6 0 1 0 6 0 A 6 6 0 1 0 -6 0",
  fillColor: "#2563eb",
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 3,
  scale: 1,
};

type LatLng = { lat: number; lng: number };

export function ConsumerDiscoverMap({
  apiKey,
  places,
  fetchError,
  totalPlaces,
}: {
  apiKey: string;
  places: Place[];
  fetchError: string | null;
  totalPlaces: number;
}) {
  // Missing key → we can't render the SDK. Show a friendly fallback for
  // end users; the dev-mode hint (env var name + setup steps) stays in
  // development so the team still knows what to fix.
  if (!apiKey) {
    const isDev = process.env.NODE_ENV !== "production";
    return (
      <SetupCard
        title="Map coming soon"
        body={
          isDev ? (
            <>
              Set{" "}
              <code className="bg-muted rounded px-1 text-[11px]">
                NEXT_PUBLIC_GMP_KEY
              </code>{" "}
              in your environment (Vercel project → Settings → Environment
              Variables) with a Google Maps JavaScript API key restricted to
              your domain, then redeploy.
            </>
          ) : (
            <>
              We&apos;re finishing the map view. Try Swipe, Catalog, or AI for
              now — every place lives there too.
            </>
          )
        }
      />
    );
  }

  if (fetchError) {
    return <SetupCard title="Couldn't load places" body={fetchError} />;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <MapView places={places} totalPlaces={totalPlaces} />
    </APIProvider>
  );
}

function MapView({
  places,
  totalPlaces,
}: {
  places: Place[];
  totalPlaces: number;
}) {
  const router = useRouter();
  const map = useMap();
  const apiLoadingStatus = useApiLoadingStatus();
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  // The Maps SDK bootstrap + first tile paint leave the canvas blank for a
  // beat — hold a muted skeleton veil over it until tiles land.
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => setMapReady(true), []);
  // Tapped marker — drives the bottom preview card. Clicking the card
  // navigates to /places/[id]; tapping the close pill clears it.
  const [selected, setSelected] = useState<Place | null>(null);
  // Lazy init lets us reason about geolocation support up-front, before any
  // effect runs. Once mounted we move to "asking" inside the effect.
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "asking" | "granted" | "denied" | "unsupported"
  >(() =>
    typeof navigator === "undefined" || !navigator.geolocation
      ? "unsupported"
      : "idle",
  );

  // Auto-request once on mount. Wrapped in an async IIFE so the setState
  // calls run via Promise microtask rather than synchronously inside the
  // effect body (React 19's set-state-in-effect lint).
  useEffect(() => {
    if (locationStatus === "unsupported") return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      setLocationStatus("asking");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationStatus("granted");
        },
        () => {
          if (cancelled) return;
          setLocationStatus("denied");
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    })();
    return () => {
      cancelled = true;
    };
    // We only want this to run on mount, so the dependency array stays
    // empty; locationStatus is captured at first-render value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const center = userLocation ?? MONTERREY_CENTER;
  const zoom = userLocation ? MAP_USER_ZOOM : MAP_DEFAULT_ZOOM;
  const mapLoadFailed =
    apiLoadingStatus === APILoadingStatus.FAILED ||
    apiLoadingStatus === APILoadingStatus.AUTH_FAILURE;
  const handleRecentre = useCallback(() => {
    if (!map || !userLocation) return;
    map.panTo(userLocation);
    map.setZoom(MAP_USER_ZOOM);
  }, [map, userLocation]);

  return (
    <div className="relative flex h-full flex-col">
      <Map
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        reuseMaps
        className="absolute inset-0 h-full w-full"
        colorScheme="LIGHT"
        styles={
          MAP_MINIMAL_STYLES as unknown as Parameters<typeof Map>[0]["styles"]
        }
        onTilesLoaded={handleMapReady}
      >
        {userLocation && (
          <Marker
            position={userLocation}
            title="You're here"
            icon={USER_ICON}
            clickable={false}
          />
        )}
        {places.map((v) => (
          <Marker
            key={v.id}
            position={{ lat: v.lat as number, lng: v.lng as number }}
            title={v.name}
            icon={placeIcon(v.listing_type === "partner")}
            onClick={() => setSelected(v)}
          />
        ))}
        <Recentre target={userLocation} />
        {selected && (
          <PanToSelected
            target={{
              lat: selected.lat as number,
              lng: selected.lng as number,
            }}
          />
        )}
      </Map>

      {/* Loading veil over the blank canvas — sits above the map, below the
          z-10 chrome overlays, so the counts/legend chrome stays visible. */}
      {!mapReady && <MapLoadingVeil loadFailed={mapLoadFailed} />}

      {/* Top overlay: counts + legend */}
      <MapChromeHeader placesCount={places.length} totalPlaces={totalPlaces} />

      {/* Geolocation state banner */}
      {(locationStatus === "denied" || locationStatus === "unsupported") && (
        <div className="bg-card/95 text-muted-foreground pointer-events-auto absolute inset-x-3 top-14 z-10 rounded-2xl px-3 py-2 text-[11px] backdrop-blur">
          {locationStatus === "denied"
            ? "Location off — showing Monterrey by default. Enable location in your browser to centre on you."
            : "Geolocation isn't supported on this device."}
        </div>
      )}

      {/* Recentre button bottom-right — pushed up when a preview card is open
          so they don't collide. */}
      {userLocation && (
        <RecentreButton onRecentre={handleRecentre} raised={!!selected} />
      )}

      {/* Bottom preview card. Tap the card to open the full place page, or
          the X to dismiss. */}
      {selected && (
        <PlacePreview
          place={selected}
          onDismiss={() => setSelected(null)}
          onOpen={() => router.push(placeHref(selected.id))}
        />
      )}
    </div>
  );
}

function PanToSelected({ target }: { target: LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // Bias the pan so the marker sits roughly above the preview card.
    map.panTo(target);
    if ((map.getZoom() ?? MAP_DEFAULT_ZOOM) < MAP_USER_ZOOM) {
      map.setZoom(MAP_USER_ZOOM);
    }
  }, [map, target]);
  return null;
}

function Recentre({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    if ((map.getZoom() ?? MAP_DEFAULT_ZOOM) < MAP_USER_ZOOM) {
      map.setZoom(MAP_USER_ZOOM);
    }
  }, [map, target]);
  return null;
}

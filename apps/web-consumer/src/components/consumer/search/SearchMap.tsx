"use client";

// Trimmed local variant of the discover map for the Search page.
//
// ConsumerDiscoverMap ships its own page chrome (counts pill + legend
// header, geolocation banner, bottom preview card) which would collide
// with this page's floating search bar and catalog rail — and the Search
// page can't edit that shared component. This copy keeps only the base
// layer: the light-styled canvas, place pins, the user dot, and pan/zoom
// behaviour. Pin taps report up via onSelectPlace so the page can sync
// the catalog rail instead of opening a preview card.

import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import {
  APIProvider,
  APILoadingStatus,
  Map,
  Marker,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import type { Place } from "@/lib/api/places";
import { Skeleton, Spinner } from "@/components/shared";

// Default map centre — Monterrey, the launch city. When geolocation
// resolves we re-centre on the consumer instead.
const DEFAULT_CENTER = { lat: 25.6714, lng: -100.3094 };
const DEFAULT_ZOOM = 13;
const USER_ZOOM = 14;

// Every place shows as a neutral gray dot; the one currently held in the
// rail (selected) turns red. No partner/web colour split here — selection
// is the only thing the pin colour encodes on this page.
const DOT_COLOR = "#9ca3af"; // Gray — default resting state
const SELECTED_COLOR = "#EF4444"; // Red — the picked/held place

// Hide every Google POI so Mesita pins own the canvas; keep roads +
// locality labels for orientation. Inline styles work because no mapId.
const MINIMAL_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "water", stylers: [{ color: "#e9f1f7" }] },
  { featureType: "landscape", stylers: [{ color: "#f7f2ec" }] },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.neighborhood",
    stylers: [{ visibility: "off" }],
  },
] as const;

const CIRCLE_PATH = "M -12 0 A 12 12 0 1 0 12 0 A 12 12 0 1 0 -12 0";

function placeIcon(isSelected: boolean) {
  return {
    path: CIRCLE_PATH,
    fillColor: isSelected ? SELECTED_COLOR : DOT_COLOR,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: isSelected ? 3.5 : 2.5,
    scale: isSelected ? 1.3 : 1,
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

export type LatLng = { lat: number; lng: number };

export function SearchMap({
  apiKey,
  places,
  userLocation,
  selectedId,
  onSelectPlace,
  onOpenPlace,
  onMapClick,
}: {
  apiKey: string;
  places: Place[];
  userLocation: LatLng | null;
  selectedId: string | null;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  // Fires on a tap of the bare map canvas (not a pin) — toggles the search
  // panel: opens when idle, closes when the results/prompt overlay is up.
  // Marker taps have their own onClick and don't trigger this.
  onMapClick?: () => void;
}) {
  // The Maps SDK bootstrap + first tile paint leave the canvas blank for a
  // beat — hold a muted skeleton veil over it until tiles actually land
  // (or the SDK load fails, so the veil can't sit there forever).
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => setMapReady(true), []);

  // No key → the overlays (search, Ask AI, rail) still work; the base
  // layer degrades to a branded hero wash instead of a dead screen.
  if (!apiKey) {
    return (
      <div className="bg-hero absolute inset-0">
        <div className="text-muted-foreground bg-card/90 shadow-elev absolute bottom-40 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium backdrop-blur">
          <MapPin className="h-3 w-3" />
          Live map coming soon
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <APIProvider apiKey={apiKey}>
        <SearchMapCanvas
          places={places}
          userLocation={userLocation}
          selectedId={selectedId}
          onSelectPlace={onSelectPlace}
          onOpenPlace={onOpenPlace}
          onMapClick={onMapClick}
          onReady={handleMapReady}
        />
        {!mapReady && <MapLoadingVeil />}
      </APIProvider>
    </div>
  );
}

// Muted skeleton veil that hides the blank canvas until tiles paint.
// Renders nothing once the SDK reports a load failure — an error state
// must never sit under an eternal skeleton. z-10 keeps it above the map
// but below the page's floating search chrome (z-20/z-30).
function MapLoadingVeil() {
  const status = useApiLoadingStatus();
  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return null;
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner
          label="Loading map"
          className="border-border border-t-primary"
        />
      </div>
    </div>
  );
}

function SearchMapCanvas({
  places,
  userLocation,
  selectedId,
  onSelectPlace,
  onOpenPlace,
  onMapClick,
  onReady,
}: {
  places: Place[];
  userLocation: LatLng | null;
  selectedId: string | null;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  onMapClick?: () => void;
  onReady: () => void;
}) {
  const located = places.filter(
    (p) => typeof p.lat === "number" && typeof p.lng === "number",
  );
  const selected = selectedId
    ? (located.find((p) => p.id === selectedId) ?? null)
    : null;

  return (
    <Map
      defaultCenter={userLocation ?? DEFAULT_CENTER}
      defaultZoom={userLocation ? USER_ZOOM : DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      reuseMaps
      className="absolute inset-0 h-full w-full"
      colorScheme="LIGHT"
      styles={MINIMAL_STYLES as unknown as Parameters<typeof Map>[0]["styles"]}
      onTilesLoaded={onReady}
      // Bare canvas tap toggles search — open when idle, close when the
      // overlay is up. Pan/drag and marker taps don't reach here.
      onClick={onMapClick ? () => onMapClick() : undefined}
    >
      {userLocation && (
        <Marker
          position={userLocation}
          title="You're here"
          icon={USER_ICON}
          clickable={false}
        />
      )}
      {located.map((place) => (
        <Marker
          key={place.id}
          position={{ lat: place.lat as number, lng: place.lng as number }}
          title={place.name}
          icon={placeIcon(place.id === selectedId)}
          // First tap picks the place (pin turns red, rail syncs); tapping
          // the already-selected pin again opens it.
          onClick={() =>
            place.id === selectedId
              ? onOpenPlace(place)
              : onSelectPlace(place)
          }
        />
      ))}
      <Recentre target={userLocation} />
      {selected && (
        <PanTo lat={selected.lat as number} lng={selected.lng as number} />
      )}
    </Map>
  );
}

// Pan to the consumer once geolocation resolves.
function Recentre({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
    if ((map.getZoom() ?? DEFAULT_ZOOM) < USER_ZOOM) {
      map.setZoom(USER_ZOOM);
    }
  }, [map, target]);
  return null;
}

// Pan to whichever pin/rail card the consumer just picked. Primitive
// lat/lng deps (not a fresh object literal) so the effect fires only when
// the SELECTION changes — re-renders must never fight the user's panning.
function PanTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
    if ((map.getZoom() ?? DEFAULT_ZOOM) < USER_ZOOM) {
      map.setZoom(USER_ZOOM);
    }
  }, [map, lat, lng]);
  return null;
}

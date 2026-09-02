"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import {
  APIProvider,
  Map,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import type { PlaceLite } from "@/lib/places-types";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GMP_KEY ?? "";

const MAP_DEFAULT_CENTER = { lat: 23.6345, lng: -102.5528 };
const MAP_DEFAULT_ZOOM = 5;
const MAP_FIT_BOUNDS_PADDING_PX = 48;
const MARKER_FILL_COLOR = "#E91E63";
const MARKER_STROKE_COLOR = "#FFFFFF";
const MARKER_STROKE_WIDTH = 2;
const MARKER_SCALE = 6;

// No `mapId` on <Map>: setting one forces cloud-side styling and the inline
// `styles` array is ignored. Without a mapId we lose AdvancedMarker, so the
// pins are drawn imperatively via google.maps.Marker in MapMarkers below.
const CLEAN_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
];

export function PlacesMap({ places }: { places: PlaceLite[] }) {
  const mappable = useMemo(
    () => places.filter((p) => p.lat !== null && p.lng !== null),
    [places],
  );
  const missing = places.length - mappable.length;

  if (!GOOGLE_MAPS_KEY) {
    return (
      <section className="border-border bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
        <p className="font-medium text-foreground">Map unavailable</p>
        <p className="mt-1">
          NEXT_PUBLIC_GMP_KEY isn&apos;t set on this
          deployment.
        </p>
      </section>
    );
  }

  if (mappable.length === 0) {
    return (
      <section className="border-border bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
        <p className="font-medium text-foreground">No mappable results</p>
        <p className="mt-1">
          None of the returned places included coordinates.
        </p>
      </section>
    );
  }

  return (
    <section className="border-border bg-card shadow-elev overflow-hidden rounded-2xl border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="text-secondary h-4 w-4" />
          <h2 className="text-foreground type-eyebrow">
            Map
          </h2>
        </div>
        <p className="text-muted-foreground text-xs">
          {mappable.length} {mappable.length === 1 ? "marker" : "markers"}
          {missing > 0 && <> · {missing} without coordinates</>}
        </p>
      </div>
      {/* Shorter on a phone: 440px of map inside a ~700px viewport left no
          room for the results it belongs to. */}
      <div className="h-72 w-full sm:h-[440px]">
        <APIProvider apiKey={GOOGLE_MAPS_KEY}>
          <Map
            defaultCenter={MAP_DEFAULT_CENTER}
            defaultZoom={MAP_DEFAULT_ZOOM}
            // COOPERATIVE, not greedy. Greedy hands every one-finger drag to
            // the map, so a phone scrolling past this section got trapped in
            // it with no way out. Cooperative pans on two fingers and lets a
            // single finger scroll the page; the zoom buttons stay.
            gestureHandling="cooperative"
            disableDefaultUI
            zoomControl
            clickableIcons={false}
            styles={CLEAN_MAP_STYLE}
          >
            <Markers places={mappable} />
            <FitBoundsToPlaces places={mappable} />
          </Map>
        </APIProvider>
      </div>
    </section>
  );
}

function FitBoundsToPlaces({ places }: { places: PlaceLite[] }) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  useEffect(() => {
    if (!map || !coreLib || places.length === 0) return;
    const bounds = new coreLib.LatLngBounds();
    for (const p of places) {
      if (p.lat !== null && p.lng !== null) {
        bounds.extend({ lat: p.lat, lng: p.lng });
      }
    }
    if (bounds.isEmpty()) return;
    map.fitBounds(bounds, MAP_FIT_BOUNDS_PADDING_PX);
  }, [map, coreLib, places]);
  return null;
}

function Markers({ places }: { places: PlaceLite[] }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!map || !markerLib) return;
    const markers: google.maps.Marker[] = [];
    for (const p of places) {
      if (p.lat === null || p.lng === null) continue;
      const marker = new markerLib.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: MARKER_FILL_COLOR,
          fillOpacity: 1,
          strokeColor: MARKER_STROKE_COLOR,
          strokeWeight: MARKER_STROKE_WIDTH,
          scale: MARKER_SCALE,
        },
        optimized: true,
      });
      marker.addListener("click", () => {
        setOpenId((id) => (id === p.id ? null : p.id));
      });
      markers.push(marker);
    }
    return () => {
      for (const m of markers) {
        m.setMap(null);
      }
    };
  }, [map, markerLib, places]);

  const openPlace =
    openId === null ? null : places.find((p) => p.id === openId) ?? null;

  if (!openPlace || openPlace.lat === null || openPlace.lng === null) {
    return null;
  }

  return (
    <InfoWindow
      position={{ lat: openPlace.lat, lng: openPlace.lng }}
      onCloseClick={() => setOpenId(null)}
    >
      <div className="max-w-[240px] text-xs">
        <p className="text-foreground text-sm font-medium">
          {openPlace.displayName || "(no name)"}
        </p>
        <p className="text-muted-foreground mt-0.5">
          {openPlace.formattedAddress}
        </p>
        <p className="text-muted-foreground/70 mt-1 font-mono break-all">
          {openPlace.id}
        </p>
      </div>
    </InfoWindow>
  );
}

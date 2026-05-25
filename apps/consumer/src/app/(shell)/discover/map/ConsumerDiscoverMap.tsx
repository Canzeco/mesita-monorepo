"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import {
  Compass,
  MapPin as MapPinIcon,
  Sparkles,
  Globe,
  Crosshair,
  X,
  ChevronRight,
} from "lucide-react";
import type { Venue } from "@/lib/api/venues";
import { PartnerBadge, RatePill } from "@/components/shared";

// Default map centre — Monterrey, since that's the city the project is
// shipping in first. If the geolocation permission lands we re-centre on
// the user instead.
const DEFAULT_CENTER = { lat: 25.6714, lng: -100.3094 };
const DEFAULT_ZOOM = 13;
const USER_ZOOM = 14;

// Marker colours — the visual gate between Mesita partners and scraped web
// listings. Close enough to the brand palette.
const PARTNER_COLOR = "#E91E63";
const WEB_COLOR = "#9ca3af";

// Minimalist map styling — turns off every POI Google would otherwise draw
// (restaurants, hospitals, schools, transit stops…) so our own venue pins
// are the only things on the canvas. Roads + locality labels stay so the
// map is still navigable. Inline styles work because we don't pass a
// mapId; switching to a cloud-based Map Style would override these.
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

// SVG circle path. Both venue markers + the user dot use this; we just
// swap fill colour. Path-symbols don't need google.maps.Size/Point so we
// can declare them up-front instead of waiting for the SDK to load.
const CIRCLE_PATH = "M -12 0 A 12 12 0 1 0 12 0 A 12 12 0 1 0 -12 0";

function venueIcon(isPartner: boolean) {
  return {
    path: CIRCLE_PATH,
    fillColor: isPartner ? PARTNER_COLOR : WEB_COLOR,
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
  venues,
  fetchError,
  totalVenues,
}: {
  apiKey: string;
  venues: Venue[];
  fetchError: string | null;
  totalVenues: number;
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
              now — every venue lives there too.
            </>
          )
        }
      />
    );
  }

  if (fetchError) {
    return <SetupCard title="Couldn't load venues" body={fetchError} />;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <MapView venues={venues} totalVenues={totalVenues} />
    </APIProvider>
  );
}

function MapView({
  venues,
  totalVenues,
}: {
  venues: Venue[];
  totalVenues: number;
}) {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  // Tapped marker — drives the bottom preview card. Clicking the card
  // navigates to /venues/[id]; tapping the close pill clears it.
  const [selected, setSelected] = useState<Venue | null>(null);
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

  const center = userLocation ?? DEFAULT_CENTER;
  const zoom = userLocation ? USER_ZOOM : DEFAULT_ZOOM;

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
          MINIMAL_STYLES as unknown as Parameters<typeof Map>[0]["styles"]
        }
      >
        {userLocation && (
          <Marker
            position={userLocation}
            title="You're here"
            icon={USER_ICON}
            clickable={false}
          />
        )}
        {venues.map((v) => (
          <Marker
            key={v.id}
            position={{ lat: v.lat as number, lng: v.lng as number }}
            title={v.name}
            icon={venueIcon(v.listing_type === "partner")}
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

      {/* Top overlay: counts + legend */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <div className="bg-card/95 text-foreground pointer-events-auto rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
          <Compass className="mr-1 inline-block h-3 w-3 -translate-y-0.5" />
          {venues.length} of {totalVenues} near here
        </div>
        <div className="bg-card/95 text-foreground pointer-events-auto flex flex-col gap-1 rounded-2xl p-2 text-[10px] font-semibold backdrop-blur">
          <LegendDot
            color={PARTNER_COLOR}
            icon={<Sparkles className="h-2.5 w-2.5" />}
          >
            Partner
          </LegendDot>
          <LegendDot color={WEB_COLOR} icon={<Globe className="h-2.5 w-2.5" />}>
            Web listing
          </LegendDot>
        </div>
      </header>

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
        <RecentreButton target={userLocation} raised={!!selected} />
      )}

      {/* Bottom preview card. Tap the card to open the full venue page, or
          the X to dismiss. */}
      {selected && (
        <VenuePreview
          venue={selected}
          onDismiss={() => setSelected(null)}
          onOpen={() => router.push(`/venues/${selected.id}`)}
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
    if ((map.getZoom() ?? DEFAULT_ZOOM) < USER_ZOOM) {
      map.setZoom(USER_ZOOM);
    }
  }, [map, target]);
  return null;
}

function VenuePreview({
  venue,
  onDismiss,
  onOpen,
}: {
  venue: Venue;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const photo = venue.photos[0];
  const subtitle = [venue.vibe, venue.category]
    .filter(Boolean)
    .join(" · ")
    .toLowerCase();
  const meta = [
    venue.price_level != null ? "$".repeat(venue.price_level) : null,
    venue.closes_at ? `until ${venue.closes_at}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-4 z-20">
      <div className="border-border bg-card shadow-elev pointer-events-auto relative flex items-stretch gap-3 overflow-hidden rounded-2xl border">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 items-center gap-3 p-2 text-left transition active:opacity-80"
        >
          <span className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
            {photo ? (
              <Image
                src={photo}
                alt={venue.name}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <span className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-base font-bold text-white">
                {venue.name[0]?.toUpperCase() ?? "·"}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="font-display truncate text-[15px] leading-tight font-semibold tracking-tight">
                {venue.name}
              </span>
              <PartnerBadge listingType={venue.listing_type} size="xs" />
            </span>
            {subtitle && (
              <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
                {subtitle}
              </span>
            )}
            {(meta ||
              (venue.listing_type === "partner" &&
                venue.cashback_percent != null &&
                venue.cashback_percent > 0)) && (
              <span className="mt-0.5 flex items-center gap-2 text-[11px]">
                {meta && <span className="text-muted-foreground">{meta}</span>}
                {venue.listing_type === "partner" &&
                  venue.cashback_percent != null &&
                  venue.cashback_percent > 0 && (
                    <RatePill
                      percent={venue.cashback_percent}
                      mechanic={
                        venue.fiscal_type === "informal"
                          ? "discount"
                          : "cashback"
                      }
                      size="xs"
                    />
                  )}
              </span>
            )}
          </span>
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close preview"
          className="bg-background/80 text-muted-foreground hover:text-foreground absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

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

function RecentreButton({
  target,
  raised = false,
}: {
  target: LatLng;
  raised?: boolean;
}) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => {
        if (!map) return;
        map.panTo(target);
        map.setZoom(USER_ZOOM);
      }}
      aria-label="Centre map on me"
      className={`bg-card text-foreground shadow-elev hover:bg-muted absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full transition ${
        raised ? "bottom-28" : "bottom-4"
      }`}
    >
      <Crosshair className="h-4 w-4" />
    </button>
  );
}

function LegendDot({
  color,
  icon,
  children,
}: {
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex h-3 w-3 items-center justify-center rounded-full text-white"
        style={{ background: color }}
      >
        {icon}
      </span>
      {children}
    </span>
  );
}

function SetupCard({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-2xl">
        <MapPinIcon className="text-muted-foreground h-5 w-5" />
      </div>
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground max-w-sm text-sm">{body}</p>
    </div>
  );
}

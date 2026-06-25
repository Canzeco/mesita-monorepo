import { ExternalLink } from "lucide-react";
import type { MyVenue } from "@/lib/api/venues";
import { cn } from "@/lib/utils";
import {
  PLACE_GOOGLE_LOCATION_INFO,
  PlaceKvField,
} from "./PlaceKvField";

function VenueMapEmbed({
  lat,
  lng,
  name,
  mapsUrl,
}: {
  lat: number;
  lng: number;
  name: string | null;
  mapsUrl: string | null;
}) {
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  return (
    <div className="border-border bg-card relative h-[140px] overflow-hidden rounded-xl border">
      <iframe
        src={src}
        title={`Map of ${name ?? "this venue"}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full w-full border-0"
      />
      {mapsUrl ? <OpenInGoogleMaps href={mapsUrl} variant="overlay" /> : null}
    </div>
  );
}

function OpenInGoogleMaps({
  href,
  variant,
}: {
  href: string;
  variant: "overlay" | "block";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full font-semibold transition";
  const skin =
    variant === "overlay"
      ? "bg-foreground/90 text-background hover:bg-foreground absolute top-3 right-3 z-10 h-9 px-3.5 text-[12px] shadow-md backdrop-blur"
      : "bg-foreground text-background hover:opacity-90 self-start h-10 px-4 text-[13px]";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open in Google Maps"
      className={cn(base, skin)}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Open in Google Maps
    </a>
  );
}

export function PlaceLocationFields({ venue }: { venue: MyVenue }) {
  const hasCoords = venue.lat != null && venue.lng != null;

  return (
    <PlaceKvField
      label="Location"
      infoMessage={PLACE_GOOGLE_LOCATION_INFO}
      value={venue.address?.trim() || undefined}
      blocked
    >
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-[13px] leading-snug",
            !venue.address?.trim() && "text-muted-foreground",
          )}
        >
          {venue.address?.trim() || "—"}
        </div>
        {hasCoords ? (
          <VenueMapEmbed
            lat={venue.lat as number}
            lng={venue.lng as number}
            name={venue.name}
            mapsUrl={venue.google_maps_url}
          />
        ) : venue.google_maps_url ? (
          <OpenInGoogleMaps href={venue.google_maps_url} variant="block" />
        ) : null}
      </div>
    </PlaceKvField>
  );
}

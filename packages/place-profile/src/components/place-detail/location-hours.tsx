"use client";

import type { ReactNode } from "react";
import { Clock, MapPin } from "lucide-react";

import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { buildUberDropoffUrl } from "../../lib/uber-link";
import { cn, formatDistanceKm } from "../../lib/format";
import { PLACE_BODY_CLASS, PLACE_META_CLASS } from "../../lib/ui";
import { PLACE_BUTTON_CLASS, PLACE_BUTTON_ICON_CLASS } from "../../lib/ui";

import { Box, BoxEmpty } from "./box";

// ── 6. Location ─────────────────────────────────────────────────────────

export function LocationBox({
  place,
  onOpenLink,
}: {
  place: PlaceDetail;
  onOpenLink?: PlaceActions["onOpenLink"];
}) {
  const mapsUrl =
    place.reviews_maps.google_maps_url ??
    `https://maps.google.com/?q=${encodeURIComponent(place.address)}`;
  // decision: Pato — Ask Uber must open a working ride deep link with the
  // place as dropoff (name + address + lat/lng when present). Legacy
  // m.uber.com/ul/?action=setPickup often fails to prefill destination.
  const uberUrl = buildUberDropoffUrl(place);
  const hasGeo =
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng);
  const embedUrl = hasGeo
    ? `https://maps.google.com/maps?q=${place.lat},${place.lng}&z=16&output=embed`
    : null;
  return (
    <Box
      title="Location"
      icon={MapPin}
      iconColor="text-muted-foreground"
      right={
        place.distance_km != null && place.distance_km > 0
          ? formatDistanceKm(place.distance_km)
          : undefined
      }
    >
      {/* A REAL MAP, SHORT (Pato, MESITA-2643: "in location keep the map,
          just make it shorter"). Google's keyless embed centred on the
          place's coordinates, 144px, inert inside the card (no scroll trap);
          the whole map is a tap through to Google Maps. MESITA-2636 had
          removed the drawn purple grid, which was never a map. No
          coordinates, no map. */}
      {embedUrl ? (
        <div className="border-border relative h-36 overflow-hidden rounded-lg border">
          <iframe
            src={embedUrl}
            title={`Map of ${place.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="pointer-events-none h-full w-full border-0"
            tabIndex={-1}
            aria-hidden
          />
          <OutboundLink
            url={mapsUrl}
            onOpenLink={onOpenLink}
            className="absolute inset-0"
          >
            <span className="sr-only">Open {place.name} in Google Maps</span>
          </OutboundLink>
        </div>
      ) : null}
      {place.address ? <p className={PLACE_BODY_CLASS}>{place.address}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <OutboundLink
          url={mapsUrl}
          onOpenLink={onOpenLink}
          className={cn(PLACE_BUTTON_CLASS, "bg-muted text-foreground hover:bg-muted/70")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/googlemaps.svg"
            alt=""
            aria-hidden
            className={PLACE_BUTTON_ICON_CLASS}
          />
          Google Maps
        </OutboundLink>
        <OutboundLink
          url={uberUrl}
          onOpenLink={onOpenLink}
          className={cn(PLACE_BUTTON_CLASS, "bg-muted text-foreground hover:bg-muted/70")}
        >
          {/* decision: Pato — Uber badge = black bg + white letters */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/uber-badge.svg"
            alt=""
            aria-hidden
            className="h-4 w-auto shrink-0"
          />
          Ask Uber
        </OutboundLink>
      </div>
    </Box>
  );
}

// ── Hours ───────────────────────────────────────────────────────────────

/** Full weekday name in the place timezone — matches hours_table.day. */
function todayWeekdayLabel(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
      new Date(),
    );
  }
}

function HoursDayRow({
  row,
  today,
}: {
  row: { day: string; range: string };
  today: string;
}) {
  // decision: Pato — full weekday on the stacked Hours card (short Mon/Tue
  // was only for the old cramped 2-col side-by-side layout).
  const isToday = row.day === today;
  const closed = row.range.toLowerCase() === "closed";
  return (
    <li
      className={cn(
        // 44px rows at 14px, the place scale (MESITA-2636); today on the
        // grey fill.
        "border-border flex min-h-11 min-w-0 items-center justify-between gap-3 border-b px-3 text-sm leading-tight last:border-b-0",
        isToday && "bg-muted",
      )}
      data-today={isToday ? "" : undefined}
    >
      <span
        className={cn(
          "shrink-0",
          isToday ? "text-foreground font-semibold" : "text-muted-foreground font-medium",
        )}
      >
        {row.day}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-right tabular-nums",
          closed
            ? "text-muted-foreground"
            : isToday
              ? "font-semibold text-foreground"
              : "text-foreground",
        )}
      >
        {row.range}
      </span>
    </li>
  );
}

export function HoursBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — Hours below Location (full-width stack); keep timezone
  // No timezone, no "today": the device's day can be the wrong one.
  //
  // THE BOX IS "HOURS" (Pato, MESITA-2685: "call that box hours or something
  // like that … time feels too weird"). With no weekly hours it says "…"
  // ("if nothing yet write ..."), never a lone "Open": the header's facts
  // row already carries the open state.
  if (place.hours_table.length === 0) {
    return (
      <Box title="Hours" icon={Clock} iconColor="text-muted-foreground">
        <BoxEmpty />
      </Box>
    );
  }
  const today = place.timezone ? todayWeekdayLabel(place.timezone) : "";
  const stateDetail = place.open_now === true
    ? place.closes_at
      ? `until ${place.closes_at}`
      : null
    : place.open_now === false && place.opens_at
      ? `opens ${place.opens_at}`
      : null;
  const tz = place.timezone || undefined;

  return (
    <Box
      title="Hours"
      icon={Clock}
      iconColor="text-muted-foreground"
    >
      {/* Unknown open state says nothing: no hours is not "Closed"
          (MESITA-2331). */}
      {place.open_now !== null && (
        <p className="text-sm leading-snug">
          <span
            className={cn(
              "font-semibold",
              place.open_now ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {place.open_now ? "Open" : "Closed"}
          </span>
          {stateDetail && (
            <>
              <span className="text-muted-foreground"> · </span>
              <span className="text-foreground">{stateDetail}</span>
            </>
          )}
        </p>
      )}
      <ul className="border-border overflow-hidden rounded-lg border">
        {place.hours_table.map((row) => (
          <HoursDayRow key={row.day} row={row} today={today} />
        ))}
      </ul>
    </Box>
  );
}

function OutboundLink({
  url,
  onOpenLink,
  className,
  children,
}: {
  url: string;
  onOpenLink?: PlaceActions["onOpenLink"];
  className: string;
  children: ReactNode;
}) {
  if (!onOpenLink) {
    return (
      <span aria-disabled="true" tabIndex={-1} className={className}>
        {children}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        onOpenLink(url);
      }}
    >
      {children}
    </a>
  );
}

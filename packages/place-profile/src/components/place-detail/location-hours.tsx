"use client";

import type { ReactNode } from "react";
import { Clock, MapPin } from "lucide-react";

import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { buildUberDropoffUrl } from "../../lib/uber-link";
import { cn, formatDistanceKm } from "../../lib/format";

import { Box } from "./box";

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
      <div
        className="relative aspect-[2/1] overflow-hidden rounded-xl"
        style={{
          backgroundColor: "#1d1442",
          backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.18) 0%, transparent 65%)
          `,
          backgroundSize: "24px 24px, 24px 24px, 100% 100%",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2">
          <div className="bg-pink-gradient shadow-glow flex h-9 w-9 items-center justify-center rounded-full">
            <MapPin
              className="h-4 w-4 fill-white text-white"
              strokeWidth={1.5}
            />
          </div>
          <span className="type-label max-w-full truncate rounded-full bg-black/60 px-2.5 py-0.5 font-medium text-white">
            {place.name}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-snug">
        {place.address}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <OutboundLink
          url={mapsUrl}
          onOpenLink={onOpenLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/googlemaps.svg"
            alt=""
            aria-hidden
            className="h-3.5 w-3.5 shrink-0"
          />
          Google Maps
        </OutboundLink>
        <OutboundLink
          url={uberUrl}
          onOpenLink={onOpenLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          {/* decision: Pato — Uber badge = black bg + white letters */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/uber-badge.svg"
            alt=""
            aria-hidden
            className="h-3.5 w-auto"
          />
          Ask Uber
        </OutboundLink>
      </div>
    </Box>
  );
}

// ── Time (hours) ────────────────────────────────────────────────────────

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
  // decision: Pato — full weekday on the stacked Time card (short Mon/Tue
  // was only for the old cramped 2-col side-by-side layout).
  const isToday = row.day === today;
  const closed = row.range.toLowerCase() === "closed";
  return (
    <li
      className={cn(
        "border-border/50 flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2.5 text-xs leading-tight last:border-b-0",
        isToday && "bg-muted/80",
      )}
    >
      <span
        className={cn(
          "shrink-0 font-semibold",
          isToday ? "text-foreground font-semibold" : "text-muted-foreground",
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
              : "text-foreground/85",
        )}
      >
        {row.range}
      </span>
    </li>
  );
}

export function HoursBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — Time below Location (full-width stack); keep timezone
  // No timezone, no "today": the device's day can be the wrong one.
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
      title="Time"
      icon={Clock}
      iconColor="text-muted-foreground"
      right={
        tz ? (
          <span className="max-w-[12rem] truncate" title={tz}>
            {tz}
          </span>
        ) : undefined
      }
    >
      {/* Unknown open state says nothing: no hours is not "Closed"
          (MESITA-2331). */}
      {place.open_now !== null && (
        <p className="text-xs leading-snug">
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
              <span className="text-foreground/80">{stateDetail}</span>
            </>
          )}
        </p>
      )}
      {place.hours_table.length > 0 && (
        <ul className="border-border overflow-hidden rounded-xl border">
          {place.hours_table.map((row) => (
            <HoursDayRow key={row.day} row={row} today={today} />
          ))}
        </ul>
      )}
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

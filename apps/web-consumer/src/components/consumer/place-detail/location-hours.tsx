"use client";

import { Clock, MapPin } from "lucide-react";

import type { PlaceDetail } from "@/lib/mock/place";
import { buildUberDropoffUrl } from "@/lib/uber-link";
import { cn, formatDistanceKm } from "@/lib/utils";

import { Box } from "./box";

// ── 6. Location ─────────────────────────────────────────────────────────

export function LocationBox({ place }: { place: PlaceDetail }) {
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
      iconColor="text-pink-500"
      right={formatDistanceKm(place.distance_km)}
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
          <span className="max-w-full truncate rounded-full bg-black/80 px-2.5 py-0.5 text-[11px] font-medium text-white">
            {place.name}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-snug">
        {place.address}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-100/70"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/googlemaps.svg"
            alt=""
            aria-hidden
            className="h-3.5 w-3.5 shrink-0"
          />
          Google Maps
        </a>
        <a
          href={uberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300/70 bg-zinc-100 px-3 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-200/70"
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
        </a>
      </div>
    </Box>
  );
}

// ── Time (hours) ────────────────────────────────────────────────────────

/** Full weekday name in the place timezone — matches hours_table.day. */
function todayWeekdayLabel(tz: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
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
        isToday && "bg-violet-50/80",
      )}
    >
      <span
        className={cn(
          "shrink-0 font-semibold",
          isToday ? "text-violet-800" : "text-foreground",
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
              ? "font-semibold text-violet-950"
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
  const today = todayWeekdayLabel(place.timezone);
  const statusDetail = place.open_now
    ? place.closes_at
      ? `until ${place.closes_at}`
      : null
    : place.opens_at
      ? `opens ${place.opens_at}`
      : null;
  const tz = place.timezone || undefined;

  return (
    <Box
      title="Time"
      icon={Clock}
      iconColor="text-violet-400"
      right={
        tz ? (
          <span className="max-w-[12rem] truncate" title={tz}>
            {tz}
          </span>
        ) : undefined
      }
    >
      <p className="text-xs leading-snug">
        <span
          className={cn(
            "font-semibold",
            place.open_now ? "text-emerald-700" : "text-muted-foreground",
          )}
        >
          {place.open_now ? "Open" : "Closed"}
        </span>
        {statusDetail && (
          <>
            <span className="text-muted-foreground"> · </span>
            <span className="text-foreground/80">{statusDetail}</span>
          </>
        )}
      </p>
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

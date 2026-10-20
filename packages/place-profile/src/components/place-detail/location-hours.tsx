"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { buildUberDropoffUrl } from "../../lib/uber-link";
import { placeMapsUrl } from "../../lib/maps-url";
import { cn, formatDistanceKm } from "../../lib/format";

import { PopularTimesBox } from "./popular-times";
import { Section } from "./section";
import { StaticMap } from "./static-map";

// ── Hours (MESITA-2441) ─────────────────────────────────────────────────
//
// decision: Pato (2026-10-19) — today first, collapsible. Closed, the row
// says the open state and today's hours; open, the week starting today.
// No timezone, no "today": the device's day can be the wrong one, so the
// week keeps its stored order and no row is marked.

/** Full weekday name in the place timezone — matches hours_table.day. */
function todayWeekdayLabel(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
    }).format(new Date());
  } catch {
    return "";
  }
}

/** The week rotated so today leads. Unknown today: as stored. */
export function weekFromToday<T extends { day: string }>(
  rows: T[],
  today: string,
): T[] {
  const at = rows.findIndex((row) => row.day === today);
  if (at <= 0) return rows;
  return [...rows.slice(at), ...rows.slice(0, at)];
}

function openStateLine(place: PlaceDetail): { word: string; detail: string | null } | null {
  // Unknown open state says nothing: no hours is not "Closed" (MESITA-2331).
  if (place.open_now === null) return null;
  if (place.open_now) {
    return { word: "Open", detail: place.closes_at ? `until ${place.closes_at}` : null };
  }
  return { word: "Closed", detail: place.opens_at ? `opens ${place.opens_at}` : null };
}

export function HoursSection({ place }: { place: PlaceDetail }) {
  const state = openStateLine(place);
  if (place.hours_table.length === 0 && !state) return null;
  const today = place.timezone ? todayWeekdayLabel(place.timezone) : "";
  const week = weekFromToday(place.hours_table, today);
  const todayRow = week.find((row) => row.day === today);

  return (
    <Section title="Hours">
      <details className="group">
        <summary
          className={cn(
            "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm [&::-webkit-details-marker]:hidden",
            week.length === 0 && "pointer-events-none",
          )}
        >
          <span className="min-w-0">
            {state && (
              <>
                <span
                  className={cn(
                    "font-semibold",
                    place.open_now ? "text-emerald-700" : "text-foreground",
                  )}
                >
                  {state.word}
                </span>
                {state.detail && (
                  <span className="text-muted-foreground"> · {state.detail}</span>
                )}
              </>
            )}
            {!state && todayRow && (
              <span className="text-foreground">Today · {todayRow.range}</span>
            )}
          </span>
          {week.length > 0 && (
            <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
              <span className="group-open:hidden">Show week</span>
              <span className="hidden group-open:inline">Hide</span>
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </span>
          )}
        </summary>
        {week.length > 0 && (
          <ul className="mt-2 flex flex-col">
            {week.map((row) => {
              const isToday = row.day === today;
              const closed = row.range.toLowerCase() === "closed";
              return (
                <li
                  key={row.day}
                  className={cn(
                    "-mx-2 flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-2 text-sm",
                    isToday && "bg-muted/80 font-semibold",
                  )}
                >
                  <span className={isToday ? "text-foreground" : "text-muted-foreground"}>
                    {row.day}
                    {isToday ? " (today)" : ""}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 truncate text-right tabular-nums",
                      closed ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {row.range}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </details>
      <PopularTimesBox place={place} />
    </Section>
  );
}

// ── Location ────────────────────────────────────────────────────────────

const outboundBtn =
  "border-border text-foreground hover:bg-muted inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition";

export function LocationSection({
  place,
  onOpenLink,
}: {
  place: PlaceDetail;
  onOpenLink?: PlaceActions["onOpenLink"];
}) {
  if (!place.address && (place.lat == null || place.lng == null)) return null;
  const mapsUrl = placeMapsUrl(place);
  // decision: Pato — Ask Uber opens a ride deep link with the place as the
  // dropoff (name + address + lat/lng when present).
  const uberUrl = buildUberDropoffUrl(place);
  return (
    <Section
      title="Location"
      right={
        place.distance_km != null && place.distance_km > 0
          ? formatDistanceKm(place.distance_km)
          : undefined
      }
    >
      {place.lat != null && place.lng != null && (
        <OutboundLink url={mapsUrl} onOpenLink={onOpenLink} className="block">
          <StaticMap lat={place.lat} lng={place.lng} label={place.name} />
        </OutboundLink>
      )}
      {place.address && (
        <p className="text-foreground text-sm leading-snug">{place.address}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <OutboundLink url={mapsUrl} onOpenLink={onOpenLink} className={outboundBtn}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/googlemaps.svg"
            alt=""
            aria-hidden
            className="h-4 w-4 shrink-0"
          />
          Google Maps
        </OutboundLink>
        <OutboundLink url={uberUrl} onOpenLink={onOpenLink} className={outboundBtn}>
          {/* decision: Pato — Uber badge = black bg + white letters */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/uber-badge.svg"
            alt=""
            aria-hidden
            className="h-4 w-auto"
          />
          Ask Uber
        </OutboundLink>
      </div>
    </Section>
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

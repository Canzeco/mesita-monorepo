"use client";

import type { ReactNode } from "react";
import { Clock, MapPin } from "lucide-react";

import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { buildUberDropoffUrl } from "../../lib/uber-link";
import { cn, formatDistanceKm } from "../../lib/format";
import { toAmPm } from "../../lib/place-time";
import { PLACE_BODY_CLASS, PLACE_META_CLASS } from "../../lib/ui";
import { PLACE_BUTTON_CLASS } from "../../lib/ui";

import { GoogleMapsMark } from "../BrandLogos";
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
          {/* The header's red G tile, not the red pin (MESITA-2688). */}
          <GoogleMapsMark />
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

/** One week row: 32px at 12px, the place scale's meta size (MESITA-3316,
 *  Pato: "make the hours smaller"; 44px at 14px from MESITA-2636): the week
 *  table is secondary, the facts row up top already says Open until X. Read
 *  here and by the skeleton's bones (MESITA-3379; they stayed 44px when the
 *  rows shrank). The today fill is the caller's add. */
/** A day of the week: the Score box's row (Pato, MESITA-3434: "it doesn't
 *  look design standardized with respect to the other boxes"), 14px, split by
 *  the list's hairlines; 32px rows in an outlined table until then. */
export const HOURS_ROW_CLASS =
  "flex min-w-0 items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0";

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
      className={HOURS_ROW_CLASS}
      data-today={isToday ? "" : undefined}
    >
      <span
        className={cn(
          "shrink-0",
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
  // like that … time feels too weird"). It is the week table only: the
  // "Open · until X" line lives in the facts row up top (Pato, MESITA-2911:
  // "don't show that … open until x"). With no weekly hours it draws nothing
  // (Pato, MESITA-2700: "Hide a box entirely when it has nothing").
  if (place.hours_table.length === 0) return null;
  const today = place.timezone ? todayWeekdayLabel(place.timezone) : "";
  // TODAY'S STATUS LEADS THE BOX (Pato, MESITA-3343: "in hours, like
  // highlight the day or mention the day at the beginning, like the status,
  // like open or closed"): the header's own words, "Open until 4 AM" or
  // "Closed until 1 PM" (MESITA-3246), after today's name; the word in
  // green or red. Unknown hours draw no line.
  const untilAt = place.open_now ? place.closes_at : place.opens_at;
  const stateWord =
    place.open_now === true ? "Open" : place.open_now === false ? "Closed" : null;
  const stateValue =
    stateWord && untilAt ? `${stateWord} until ${toAmPm(untilAt)}` : stateWord;

  return (
    <Box
      title="Hours"
      icon={Clock}
      iconColor="text-muted-foreground"
    >
      {/* IN THE GREY PANEL (Pato, MESITA-3440: "hours must go inside a gray
          box too ... what we did with presentation"): the AboutBox panel. */}
      <ul className="divide-border bg-muted divide-y rounded-lg px-4 py-3" data-hours-week>
        {/* NOW IS THE FIRST ROW (Pato, MESITA-3436: "time must be on top of
            all days as an eighth row ... joined, same size, but with the text
            ... at the right, and in green"): the same row as the days, the
            state at the right, green when open and red when closed. The
            coloured chip above the list (MESITA-3368) left. */}
        {stateValue ? (
          <li className={HOURS_ROW_CLASS} data-hours-today>
            <span className="text-muted-foreground flex shrink-0 items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              Now
            </span>
            <span
              className={cn(
                "min-w-0 truncate text-right font-semibold",
                place.open_now ? "text-emerald-600" : "text-red-600",
              )}
            >
              {stateValue}
            </span>
          </li>
        ) : null}
        {place.hours_table.map((row) => (
          <HoursDayRow key={row.day} row={row} today={today} />
        ))}
      </ul>
    </Box>
  );
}

export function OutboundLink({
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

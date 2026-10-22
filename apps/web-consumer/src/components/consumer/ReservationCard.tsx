"use client";

import Link from "next/link";

import Image from "next/image";
import { Calendar, Users } from "lucide-react";
import { Skeleton, SkeletonLine } from "@/components/shared";
import type { ReservationItem } from "@/lib/reservation-types";
import { stateMeta } from "@/lib/reservation-state";
import { cn, guestNoun } from "@/lib/utils";
import { reservationPath } from "@/lib/consumer-route-contract";

// Reservation card. Booking metadata only: the place, the slot, the party,
// the state and the Reservationist's note.

/** The card's frame, its 64px photo, its meta row and its note box: one set
 *  for ReservationCard and ReservationCardSkeleton, so the loading card
 *  cannot drift from the loaded one. */
const CARD_FRAME =
  "border-border bg-card flex flex-col gap-3 overflow-hidden rounded-2xl border p-3";
const CARD_PHOTO = "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl";
const CARD_META = "mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs";
const CARD_NOTE = "rounded-xl px-3 py-2 text-xs leading-snug";

/** ReservationCard while consumer-web-list-reservations is out (Pato,
 *  MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"; a centred spinner before): the same white
 *  frame, the 64px photo, the name line (16px, tight) with the 20px state
 *  pill at its right, the 12px meta row as its three pieces — when, party,
 *  #code — wrapping where the real one does, and the note box one line
 *  tall. The note is drawn on every card: five of the six phases carry one,
 *  only Confirmed does not. The photo bounds the row, so a wrapped meta row
 *  moves nothing. */
export function ReservationCardSkeleton() {
  return (
    <div aria-hidden className={CARD_FRAME}>
      <div className="flex items-start gap-3">
        <Skeleton className={CARD_PHOTO} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <SkeletonLine
              className="min-w-0 flex-1 text-base leading-tight"
              bar="w-3/5"
            />
            <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
          </div>
          <div className={CARD_META}>
            <SkeletonLine className="w-32" bar="w-full" />
            <SkeletonLine className="w-16" bar="w-full" />
            <SkeletonLine className="w-16" bar="w-full" />
          </div>
        </div>
      </div>
      {/* One non-breaking space gives the box the note's own line-height. */}
      <div className={cn(CARD_NOTE, "relative")}>
        &nbsp;
        <Skeleton className="absolute inset-0 rounded-xl" />
      </div>
    </div>
  );
}

export function ReservationCard({ r }: { r: ReservationItem }) {
  const meta = stateMeta(r.state);
  // "spent" = finished and not happening (passed / cancelled / not booked).
  const spent = meta.spent;
  // Tapping the card opens the intercepted /reservation/[id] modal on
  // soft nav and the full page on hard nav.
  return (
    <Link
      href={reservationPath(r.id)}
      aria-label={`Open reservation at ${r.placeName}`}
      className={cn(
        CARD_FRAME,
        "hover:bg-muted/40 transition active:scale-[0.995]",
        spent && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("bg-muted", CARD_PHOTO)}>
          {r.placePhoto ? (
            <Image
              src={r.placePhoto}
              alt={r.placeName}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "font-display truncate text-base leading-tight font-semibold",
                spent && "line-through",
              )}
            >
              {r.placeName}
            </h3>
            <span
              className={cn(
                "type-meta inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 font-semibold",
                meta.pillClass,
              )}
            >
              <meta.Icon
                className={cn("h-3 w-3", meta.iconClass)}
                strokeWidth={2.25}
              />
              {meta.label}
            </span>
          </div>

          <div className={cn("text-muted-foreground", CARD_META)}>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {r.when}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {r.partySize} {guestNoun(r.partySize)}
            </span>
            {r.referenceCode && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="tabular-nums">#{r.referenceCode}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {r.stateNote && (
        <div
          className={cn(
            CARD_NOTE,
            r.state === "booking"
              ? "bg-muted text-foreground ring-1 ring-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {r.stateNote}
        </div>
      )}
    </Link>
  );
}

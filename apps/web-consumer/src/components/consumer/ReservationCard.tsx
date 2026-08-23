"use client";

import Link from "next/link";

import Image from "next/image";
import { Calendar, Users } from "lucide-react";
import type { ReservationItem } from "@/lib/mock/reservations-mock";
import { statusMeta } from "@/lib/reservation-status";
import { cn, guestNoun } from "@/lib/utils";
import { reservationPath } from "@/lib/consumer-route-contract";

// Reservation card. Booking metadata only — and no reward surface at all:
// a discount comes from SHOWING UP (the visit ticket snapshots its own
// rates), never from holding a booking.

export function ReservationCard({ r }: { r: ReservationItem }) {
  const meta = statusMeta(r.status);
  // "spent" = finished and not happening (passed / cancelled / not booked).
  const spent = meta.spent;
  // Tapping the card opens the intercepted /reservation/[id] modal on
  // soft nav and the full page on hard nav.
  return (
    <Link
      href={reservationPath(r.id)}
      aria-label={`Open reservation at ${r.placeName}`}
      className={cn(
        "border-border bg-card hover:bg-muted/40 flex flex-col gap-3 overflow-hidden rounded-2xl border p-3 transition active:scale-[0.995]",
        spent && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
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

          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
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

      {r.statusNote && (
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-xs leading-snug",
            r.status === "booking"
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-400/30"
              : "bg-muted text-muted-foreground",
          )}
        >
          {r.statusNote}
        </div>
      )}
    </Link>
  );
}

"use client";

import Image from "next/image";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import type {
  ReservationItem,
  ReservationStatus,
} from "@/lib/mock/reservations-mock";
import { cn, guestNoun } from "@/lib/utils";
import {
  LinkedCouponCard,
  MetaRow,
} from "@/components/consumer/reservation-detail-ui";
import { ReservationActions } from "@/components/consumer/reservation-actions";

// Shared body for /reservation/[id]. Used by both the intercepted modal
// (ReservationDetailModalShell) and the hard-nav page. Stays narrow on
// purpose — booking metadata, the linked coupon if any, and the few
// reservation-level actions. No payment, no bill math (that happens at
// the table); no full place detail (that lives on /places/[id]).

const STATUS_META: Record<
  ReservationStatus,
  {
    label: string;
    pillClass: string;
    Icon: typeof Clock;
    iconClass: string;
    banner: string | null;
  }
> = {
  booking: {
    label: "Booking",
    pillClass: "border-amber-500/30 bg-amber-50 text-amber-800",
    Icon: Clock,
    iconClass: "text-amber-600",
    banner:
      "We're booking this for you — you'll get a confirmation as soon as the place replies.",
  },
  booked: {
    label: "Booked",
    pillClass: "border-emerald-500/30 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
    banner: null,
  },
  cancelled: {
    label: "Cancelled",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: X,
    iconClass: "text-muted-foreground",
    banner:
      "This reservation is cancelled. Saved rewards remain valid for a new booking.",
  },
};

export function ReservationDetailBody({ r }: { r: ReservationItem }) {
  const meta = STATUS_META[r.status];
  const cancelled = r.status === "cancelled";
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* Hero — place photo + name + status pill stacked. Larger than the
          list card so the screen reads like a ticket, not a list row. */}
      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted relative aspect-[16/9] w-full">
          {r.placePhoto ? (
            <Image
              src={r.placePhoto}
              alt={r.placeName}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className={cn(
                "object-cover",
                cancelled && "opacity-80 grayscale",
              )}
            />
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-2 px-4 py-3">
          <h1
            className={cn(
              "font-display text-xl leading-tight font-semibold tracking-tight",
              cancelled && "line-through",
            )}
          >
            {r.placeName}
          </h1>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
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
      </section>

      {meta.banner && (
        <p
          className={cn(
            "rounded-2xl px-3 py-2.5 text-[12.5px] leading-snug",
            r.status === "booking"
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-400/30"
              : "bg-muted text-muted-foreground",
          )}
        >
          {r.statusNote ?? meta.banner}
        </p>
      )}

      {/* Reservation metadata list. iOS Settings-style rows. */}
      <section className="border-border bg-card divide-border/70 divide-y overflow-hidden rounded-2xl border">
        <MetaRow Icon={Calendar} label="When" value={r.when} />
        <MetaRow
          Icon={Users}
          label="Party"
          value={`${r.partySize} ${guestNoun(r.partySize)}`}
        />
        <MetaRow
          Icon={meta.Icon}
          iconClass={meta.iconClass}
          label="Status"
          value={meta.label}
        />
      </section>

      {r.linkedCoupon && !cancelled && (
        <LinkedCouponCard coupon={r.linkedCoupon} />
      )}

      <ReservationActions projectId={r.projectId} cancelled={cancelled} />
    </div>
  );
}

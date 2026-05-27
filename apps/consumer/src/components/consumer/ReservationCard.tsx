"use client";

import Image from "next/image";
import {
  Calendar,
  Users,
  Clock,
  X,
  CheckCircle2,
  Ticket,
  Instagram,
} from "lucide-react";
import type {
  ReservationItem,
  ReservationStatus,
  LinkedCouponSummary,
} from "@/lib/mock/reservations-mock";
import { cn } from "@/lib/utils";

// Reservation card. Booking metadata only. When the reservation has a
// linked coupon (the wallet entry tied to the visit), a small "ticket
// stub" rides along underneath the card — dashed perforated edge above
// it sells the metaphor without needing a literal scissor icon.

const STATUS_META: Record<
  ReservationStatus,
  {
    label: string;
    pillClass: string;
    Icon: typeof Clock;
    iconClass: string;
  }
> = {
  booking: {
    label: "Booking",
    pillClass: "border-amber-500/30 bg-amber-50 text-amber-800",
    Icon: Clock,
    iconClass: "text-amber-600",
  },
  booked: {
    label: "Booked",
    pillClass: "border-emerald-500/30 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
  },
  cancelled: {
    label: "Cancelled",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: X,
    iconClass: "text-muted-foreground",
  },
};

export function ReservationCard({ r }: { r: ReservationItem }) {
  const meta = STATUS_META[r.status];
  const cancelled = r.status === "cancelled";
  return (
    <article
      className={cn(
        "border-border bg-card flex flex-col gap-3 overflow-hidden rounded-2xl border p-3",
        cancelled && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          {r.venuePhoto ? (
            <Image
              src={r.venuePhoto}
              alt={r.venueName}
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
                cancelled && "line-through",
              )}
            >
              {r.venueName}
            </h3>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
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

          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {r.when}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {r.partySize} {r.partySize === 1 ? "person" : "people"}
            </span>
          </div>
        </div>
      </div>

      {r.statusNote && (
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-[12px] leading-snug",
            r.status === "booking"
              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-400/30"
              : "bg-muted text-muted-foreground",
          )}
        >
          {r.statusNote}
        </div>
      )}

      {/* Linked coupon ticket stub — only renders if the reservation
          has a coupon tied to it. Dashed border-top sells the
          "perforated edge" metaphor; the inline ticket icon + the
          small percent badge keep the stub visually distinct from
          the main reservation surface above. */}
      {r.linkedCoupon && !cancelled && (
        <LinkedCouponStub coupon={r.linkedCoupon} />
      )}
    </article>
  );
}

function LinkedCouponStub({ coupon }: { coupon: LinkedCouponSummary }) {
  const ig = coupon.kind === "instagram";
  return (
    <div className="-mx-3 -mb-3 flex items-center gap-2.5 border-t border-dashed border-border/70 bg-pink-500/[0.04] px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 ring-1 ring-pink-500/20">
        {ig ? (
          <Instagram className="h-4 w-4 text-pink-600" strokeWidth={2} />
        ) : (
          <Ticket className="h-4 w-4 text-pink-600" strokeWidth={2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Coupon tied
        </p>
        <p className="text-foreground mt-0.5 text-[13px] leading-tight font-semibold">
          <span className="text-pink-600">{coupon.percent}%</span>{" "}
          cashback{" "}
          <span className="text-muted-foreground font-normal">
            · {coupon.tierLabel}
          </span>
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          coupon.state === "active"
            ? "border-emerald-500/30 bg-emerald-50 text-emerald-800"
            : "border-amber-500/30 bg-amber-50 text-amber-800",
        )}
      >
        {coupon.state === "active" ? "Active" : "Pending"}
      </span>
    </div>
  );
}

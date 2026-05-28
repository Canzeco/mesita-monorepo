"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Instagram,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Calendar,
} from "lucide-react";
import type {
  CouponItem,
  NormalCouponStatus,
  InstagramCouponStatus,
  LinkedReservationSummary,
} from "@/lib/mock/coupons-mock";
import { cn } from "@/lib/utils";

// Coupon card. Split by kind because the lifecycles + the calls to
// action diverge enough that one card with every possible state is
// harder to read than two specialized ones. When the coupon is tied
// to a known reservation (auto-issued or attached at booking), a
// small reservation-ticket stub appears below the card — dashed
// perforated edge sells the "ticket pair" metaphor.

const NORMAL_STATUS: Record<
  NormalCouponStatus,
  { label: string; pillClass: string; Icon: typeof Clock }
> = {
  active: {
    label: "Active",
    pillClass: "border-emerald-500/30 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
  },
  redeemed: {
    label: "Redeemed",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: CheckCircle2,
  },
  expired: {
    label: "Expired",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: Clock,
  },
  cancelled: {
    label: "Cancelled",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: X,
  },
};

const IG_STATUS: Record<
  InstagramCouponStatus,
  { label: string; pillClass: string; Icon: typeof Clock }
> = {
  pending_story: {
    label: "Post your story",
    pillClass: "border-pink-500/30 bg-pink-50 text-pink-800",
    Icon: Instagram,
  },
  under_review: {
    label: "Under review",
    pillClass: "border-amber-500/30 bg-amber-50 text-amber-800",
    Icon: Clock,
  },
  verified: {
    label: "Verified · Active",
    pillClass: "border-emerald-500/30 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected — try again",
    pillClass: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: AlertCircle,
  },
  redeemed: {
    label: "Redeemed",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: CheckCircle2,
  },
  expired: {
    label: "Expired",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: Clock,
  },
};

export function CouponCard({ c }: { c: CouponItem }) {
  const isInstagram = c.kind === "instagram";
  const muted =
    c.status === "expired" ||
    c.status === "redeemed" ||
    (c.kind === "normal" && c.status === "cancelled");
  const meta = isInstagram
    ? IG_STATUS[c.status as InstagramCouponStatus]
    : NORMAL_STATUS[c.status as NormalCouponStatus];

  // Tapping the card opens the intercepted /coupon/[id] modal on soft
  // nav and the full page on hard nav. The linked-reservation stub stays
  // inside the same link so the whole ticket pair is one tap target.
  return (
    <Link
      href={`/coupon/${c.id}`}
      aria-label={`Open coupon for ${c.venueName}`}
      className={cn(
        "block overflow-hidden rounded-2xl border transition active:scale-[0.995]",
        muted
          ? "border-border bg-card opacity-70"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <div className="flex">
        <div className="bg-muted relative h-auto w-20 shrink-0">
          {c.venuePhoto ? (
            <Image
              src={c.venuePhoto}
              alt={c.venueName}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display truncate text-base leading-tight font-semibold">
                {c.venueName}
              </h3>
              <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                {c.tierLabel} · {c.capLabel}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-foreground text-2xl leading-none font-semibold">
                {c.percent}
                <span className="text-foreground/70 text-base">%</span>
              </p>
              <p className="text-muted-foreground mt-0.5 text-[9px] font-bold tracking-[0.16em] uppercase">
                cashback
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                meta.pillClass,
              )}
            >
              <meta.Icon className="h-3 w-3" strokeWidth={2.25} />
              {meta.label}
            </span>
            {isInstagram && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px]">
                <Sparkles className="h-3 w-3" />
                Story coupon
              </span>
            )}
          </div>

          {isInstagram && c.status === "rejected" && c.rejectReason && (
            <p className="bg-destructive/10 text-destructive rounded-lg px-2.5 py-1.5 text-[11px] leading-snug">
              {c.rejectReason}
            </p>
          )}
        </div>
      </div>

      {/* Linked reservation ticket stub — only renders if a reservation
          is tied to the coupon AND the coupon isn't in a terminal state
          where it wouldn't matter anyway. */}
      {c.linkedReservation && !muted && (
        <LinkedReservationStub reservation={c.linkedReservation} />
      )}
    </Link>
  );
}

function LinkedReservationStub({
  reservation,
}: {
  reservation: LinkedReservationSummary;
}) {
  const isBooking = reservation.state === "booking";
  return (
    <div className="flex items-center gap-2.5 border-t border-dashed border-border/70 bg-emerald-500/[0.04] px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
        <Calendar className="h-4 w-4 text-emerald-700" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Reservation tied
        </p>
        <p className="text-foreground mt-0.5 text-[13px] leading-tight font-semibold truncate">
          {reservation.when}{" "}
          <span className="text-muted-foreground font-normal">
            · {reservation.partySize}{" "}
            {reservation.partySize === 1 ? "person" : "people"}
          </span>
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          isBooking
            ? "border-amber-500/30 bg-amber-50 text-amber-800"
            : "border-emerald-500/30 bg-emerald-50 text-emerald-800",
        )}
      >
        {isBooking ? "Booking" : "Booked"}
      </span>
    </div>
  );
}

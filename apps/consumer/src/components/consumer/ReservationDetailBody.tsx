"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  X,
  Ticket,
  Instagram,
  MapPin,
  CalendarPlus,
  Phone,
} from "lucide-react";
import type {
  LinkedCouponSummary,
  ReservationItem,
  ReservationStatus,
} from "@/lib/mock/reservations-mock";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

// Shared body for /reservation/[id]. Used by both the intercepted modal
// (ReservationDetailModalShell) and the hard-nav page. Stays narrow on
// purpose — booking metadata, the linked coupon if any, and the few
// reservation-level actions. No payment, no cashback math (that lives
// on /pay/wallet); no full venue detail (that lives on /venues/[id]).

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
      "We're booking this for you — you'll get a confirmation as soon as the venue replies.",
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
      "This reservation is cancelled. Saved coupons remain valid for a new booking.",
  },
};

export function ReservationDetailBody({ r }: { r: ReservationItem }) {
  const meta = STATUS_META[r.status];
  const cancelled = r.status === "cancelled";
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* Hero — venue photo + name + status pill stacked. Larger than the
          list card so the screen reads like a ticket, not a list row. */}
      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted relative aspect-[16/9] w-full">
          {r.venuePhoto ? (
            <Image
              src={r.venuePhoto}
              alt={r.venueName}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className={cn("object-cover", cancelled && "grayscale opacity-80")}
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
            {r.venueName}
          </h1>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
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
          value={`${r.partySize} ${r.partySize === 1 ? "person" : "people"}`}
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

      {/* Action cluster — keep it scoped to what a reservation can do.
          Payment, cashback redemption, and the full venue page each have
          their own surfaces; we just link out. */}
      <section className="flex flex-col gap-2">
        <Link
          href={`/venues/${r.venueId}`}
          className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition"
        >
          <span className="flex items-center gap-3">
            <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">View venue</span>
          </span>
          <span className="text-muted-foreground text-[12px]">Details, map, menu</span>
        </Link>

        {!cancelled && (
          <>
            <button
              type="button"
              onClick={() =>
                toast.action(
                  "Calendar export lands with the booking integration.",
                  { label: "Notify me", onClick: () => {} },
                )
              }
              className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
            >
              <span className="flex items-center gap-3">
                <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
                  <CalendarPlus className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">Add to calendar</span>
              </span>
              <span className="text-muted-foreground text-[12px]">
                Google, Apple, Outlook
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                toast.action(
                  "Calling the venue from inside the app lands soon.",
                  { label: "Notify me", onClick: () => {} },
                )
              }
              className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
            >
              <span className="flex items-center gap-3">
                <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
                  <Phone className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">Call venue</span>
              </span>
              <span className="text-muted-foreground text-[12px]">If plans change</span>
            </button>

            <button
              type="button"
              onClick={() =>
                toast.action(
                  "Cancellation lands with the booking integration. Email support@mesita.ai meanwhile.",
                  { label: "Copy email", onClick: () => {} },
                )
              }
              className="border-border bg-card hover:bg-muted flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold text-foreground/80 transition"
            >
              Cancel reservation
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function MetaRow({
  Icon,
  iconClass,
  label,
  value,
}: {
  Icon: typeof Clock;
  iconClass?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon
        className={cn("text-muted-foreground h-4 w-4", iconClass)}
        strokeWidth={2}
      />
      <span className="text-muted-foreground flex-1 text-[12px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm font-semibold">{value}</span>
    </div>
  );
}

function LinkedCouponCard({ coupon }: { coupon: LinkedCouponSummary }) {
  const ig = coupon.kind === "instagram";
  return (
    <Link
      href={`/coupon/${coupon.id}`}
      className="hover:bg-pink-500/[0.06] flex items-center gap-3 rounded-2xl border border-pink-500/15 bg-pink-500/[0.04] px-4 py-3.5 transition"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-500/15 ring-1 ring-pink-500/20">
        {ig ? (
          <Instagram className="h-5 w-5 text-pink-600" strokeWidth={2} />
        ) : (
          <Ticket className="h-5 w-5 text-pink-600" strokeWidth={2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Coupon tied to this reservation
        </p>
        <p className="text-foreground mt-0.5 text-[14px] leading-tight font-semibold">
          <span className="text-pink-600">{coupon.percent}%</span> cashback{" "}
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
    </Link>
  );
}

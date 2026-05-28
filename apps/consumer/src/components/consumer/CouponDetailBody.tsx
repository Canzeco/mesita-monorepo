"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Instagram,
  MapPin,
  Share2,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  CouponItem,
  InstagramCouponStatus,
  LinkedReservationSummary,
  NormalCouponStatus,
} from "@/lib/mock/coupons-mock";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

// Shared body for /coupon/[id]. Used by both the intercepted modal
// (CouponDetailModalShell) and the hard-nav page. Same pattern as
// ReservationDetailBody / VenueDetailBody.
//
// Lifecycle copy + the "what to do next" callout differ between normal
// and Instagram coupons, so each renders its own status-meta record.
// Everything else (hero, metadata rows, linked-reservation card, action
// cluster) is shared.

type StatusMeta = {
  label: string;
  pillClass: string;
  Icon: LucideIcon;
  iconClass: string;
  banner: { tone: "info" | "warn" | "error" | "muted"; text: string } | null;
};

const NORMAL_STATUS: Record<NormalCouponStatus, StatusMeta> = {
  active: {
    label: "Active",
    pillClass: "border-emerald-500/30 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
    banner: null,
  },
  redeemed: {
    label: "Redeemed",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: CheckCircle2,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "Already redeemed. Cashback landed on /pay/wallet.",
    },
  },
  expired: {
    label: "Expired",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: Clock,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "This coupon expired. Save the venue again to mint a fresh one.",
    },
  },
  cancelled: {
    label: "Cancelled",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: X,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "Cancelled. Tap the venue to mint a new coupon.",
    },
  },
};

const IG_STATUS: Record<InstagramCouponStatus, StatusMeta> = {
  pending_story: {
    label: "Post your story",
    pillClass: "border-pink-500/30 bg-pink-50 text-pink-800",
    Icon: Instagram,
    iconClass: "text-pink-600",
    banner: {
      tone: "info",
      text: "Post the welcome story tagged @mesita to unlock this coupon. We auto-detect it within a few minutes.",
    },
  },
  under_review: {
    label: "Under review",
    pillClass: "border-amber-500/30 bg-amber-50 text-amber-800",
    Icon: Clock,
    iconClass: "text-amber-600",
    banner: {
      tone: "warn",
      text: "We saw your story — a Mesita reviewer is confirming it now.",
    },
  },
  verified: {
    label: "Verified · Active",
    pillClass: "border-emerald-500/30 bg-emerald-50 text-emerald-800",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
    banner: null,
  },
  rejected: {
    label: "Rejected — try again",
    pillClass: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: AlertCircle,
    iconClass: "text-destructive",
    banner: null, // reject reason renders separately
  },
  redeemed: {
    label: "Redeemed",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: CheckCircle2,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "Already redeemed. Cashback landed on /pay/wallet.",
    },
  },
  expired: {
    label: "Expired",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: Clock,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "This coupon expired. Save the venue again to mint a fresh one.",
    },
  },
};

export function CouponDetailBody({ c }: { c: CouponItem }) {
  const isInstagram = c.kind === "instagram";
  const meta = isInstagram
    ? IG_STATUS[c.status as InstagramCouponStatus]
    : NORMAL_STATUS[c.status as NormalCouponStatus];
  const muted =
    c.status === "expired" ||
    c.status === "redeemed" ||
    (c.kind === "normal" && c.status === "cancelled");

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* Hero — venue photo, name, status. Cashback % printed huge so the
          coupon reads like a ticket, not a list row. */}
      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted relative aspect-[16/9] w-full">
          {c.venuePhoto ? (
            <Image
              src={c.venuePhoto}
              alt={c.venueName}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className={cn("object-cover", muted && "grayscale opacity-80")}
            />
          ) : null}
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl leading-tight font-semibold tracking-tight">
              {c.venueName}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              {c.tierLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-foreground text-3xl leading-none font-semibold">
              {c.percent}
              <span className="text-foreground/70 text-lg">%</span>
            </p>
            <p className="text-muted-foreground mt-0.5 text-[9px] font-bold tracking-[0.16em] uppercase">
              cashback
            </p>
          </div>
        </div>
        <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              meta.pillClass,
            )}
          >
            <meta.Icon
              className={cn("h-3 w-3", meta.iconClass)}
              strokeWidth={2.25}
            />
            {meta.label}
          </span>
          {isInstagram && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[10.5px]">
              <Sparkles className="h-3 w-3" />
              Story coupon
            </span>
          )}
        </div>
      </section>

      {meta.banner && <StatusBanner banner={meta.banner} />}

      {c.kind === "instagram" &&
        c.status === "rejected" &&
        c.rejectReason && (
          <p className="bg-destructive/10 text-destructive rounded-2xl px-3 py-2.5 text-[12.5px] leading-snug">
            {c.rejectReason}
          </p>
        )}

      {/* Coupon metadata list — tier, cap, expiry. iOS Settings-style. */}
      <section className="border-border bg-card divide-border/70 divide-y overflow-hidden rounded-2xl border">
        <MetaRow Icon={Ticket} label="Tier" value={c.tierLabel} />
        <MetaRow Icon={Sparkles} label="Cap" value={c.capLabel} />
        <MetaRow
          Icon={Calendar}
          label="Expires"
          value={c.expiresAt ?? "No expiry"}
        />
      </section>

      {c.linkedReservation && !muted && (
        <LinkedReservationCard reservation={c.linkedReservation} />
      )}

      {/* Action cluster. Coupons are scoped to "see where I can use it" +
          "what to do next" — payment is on /pay/wallet, the actual
          redemption happens at the venue via QR scan. */}
      <section className="flex flex-col gap-2">
        <Link
          href={`/venues/${c.venueId}`}
          className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition"
        >
          <span className="flex items-center gap-3">
            <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">View venue</span>
          </span>
          <span className="text-muted-foreground text-[12px]">
            Details, map, menu
          </span>
        </Link>

        {isInstagram && c.status === "pending_story" && (
          <button
            type="button"
            onClick={() =>
              toast.action(
                "Story-tag auto-detection ships with the Meta Graph integration.",
                { label: "Notify me", onClick: () => {} },
              )
            }
            className="bg-pink-gradient flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
          >
            <Instagram className="h-4 w-4" strokeWidth={2} />
            Open Instagram & post story
          </button>
        )}

        {!muted && c.kind === "normal" && c.status === "active" && (
          <button
            type="button"
            onClick={() =>
              toast.action(
                "QR redemption lands with the venue scanner integration.",
                { label: "Notify me", onClick: () => {} },
              )
            }
            className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
          >
            <span className="flex items-center gap-3">
              <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
                <Ticket className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">Show at venue</span>
            </span>
            <span className="text-muted-foreground text-[12px]">
              QR for the host
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            toast.action(
              "Sharing a coupon link with a friend lands soon.",
              { label: "Notify me", onClick: () => {} },
            )
          }
          className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
        >
          <span className="flex items-center gap-3">
            <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
              <Share2 className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">Share with a friend</span>
          </span>
          <span className="text-muted-foreground text-[12px]">
            They get a coupon too
          </span>
        </button>
      </section>
    </div>
  );
}

function StatusBanner({
  banner,
}: {
  banner: NonNullable<StatusMeta["banner"]>;
}) {
  const tone = {
    info: "border-sky-400/30 bg-sky-50 text-sky-900",
    warn: "border-amber-400/30 bg-amber-50 text-amber-900",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    muted: "border-border bg-muted text-muted-foreground",
  }[banner.tone];
  return (
    <p
      className={cn(
        "rounded-2xl border px-3 py-2.5 text-[12.5px] leading-snug",
        tone,
      )}
    >
      {banner.text}
    </p>
  );
}

function MetaRow({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="text-muted-foreground h-4 w-4" strokeWidth={2} />
      <span className="text-muted-foreground flex-1 text-[12px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm font-semibold">{value}</span>
    </div>
  );
}

function LinkedReservationCard({
  reservation,
}: {
  reservation: LinkedReservationSummary;
}) {
  const isBooking = reservation.state === "booking";
  return (
    <Link
      href={`/reservation/${reservation.id}`}
      className="hover:bg-emerald-500/[0.06] flex items-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3.5 transition"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
        <Calendar className="h-5 w-5 text-emerald-700" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          Reservation tied to this coupon
        </p>
        <p className="text-foreground mt-0.5 truncate text-[14px] leading-tight font-semibold">
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
    </Link>
  );
}

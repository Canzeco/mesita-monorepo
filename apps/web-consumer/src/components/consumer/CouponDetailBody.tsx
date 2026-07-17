"use client";

import Image from "next/image";
import {
  Calendar,
  Sparkles,
  Ticket,
} from "lucide-react";
import type {
  CouponItem,
  InstagramCouponStatus,
  NormalCouponStatus,
} from "@/lib/mock/coupons-mock";
import { LinkedReservationCard } from "@/components/consumer/LinkedReservationCard";
import { CouponDetailActions } from "@/components/consumer/coupon-detail-actions";
import { MetaRow, StatusBanner } from "@/components/consumer/coupon-detail-ui";
import { IG_STATUS, NORMAL_STATUS } from "@/components/consumer/coupon-status";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Shared body for /coupon/[id]. Used by both the intercepted modal
// (CouponDetailModalShell) and the hard-nav page. Same pattern as
// ReservationDetailBody / PlaceDetailBody.
//
// Lifecycle copy + the "what to do next" callout differ between normal
// and Instagram coupons, so each renders its own status-meta record.
// Everything else (hero, metadata rows, linked-reservation card, action
// cluster) is shared.

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
      {/* Hero — place photo, name, status. Reward % printed huge so the
          coupon reads like a ticket, not a list row. */}
      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="bg-muted relative aspect-[16/9] w-full">
          {c.placePhoto ? (
            <Image
              src={c.placePhoto}
              alt={c.placeName}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className={cn("object-cover", muted && "opacity-80 grayscale")}
            />
          ) : null}
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl leading-tight font-semibold tracking-tight">
              {c.placeName}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              {c.classLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-foreground text-3xl leading-none font-semibold">
              {c.percent}
              <span className="text-foreground/70 text-lg">%</span>
            </p>
            <p className="text-muted-foreground mt-0.5 text-[9px] font-bold tracking-[0.16em] uppercase">
              reward
            </p>
          </div>
        </div>
        <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
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

      {c.kind === "instagram" && c.status === "rejected" && c.rejectReason && (
        <p className={cn(ERROR_BOX_CLASS, "rounded-2xl px-3 py-2.5 text-[12.5px] leading-snug")}>
          {c.rejectReason}
        </p>
      )}

      {/* Coupon metadata list — class, cap, expiry. iOS Settings-style. */}
      <section className="border-border bg-card divide-border/70 divide-y overflow-hidden rounded-2xl border">
        <MetaRow Icon={Ticket} label="Class" value={c.classLabel} />
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

      <CouponDetailActions
        projectId={c.projectId}
        kind={c.kind}
        status={c.status}
        muted={muted}
      />
    </div>
  );
}

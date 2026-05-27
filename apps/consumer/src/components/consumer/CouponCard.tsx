"use client";

import Image from "next/image";
import {
  Instagram,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import type {
  CouponItem,
  NormalCouponStatus,
  InstagramCouponStatus,
} from "@/lib/mock/coupons-mock";
import { cn } from "@/lib/utils";

// Coupon card — discount instrument. Split by kind because the
// lifecycles + the calls to action diverge enough that one card with
// every possible state is harder to read than two specialized ones.
//
//   normal     auto-issued from a save; just shows the discount + a
//              status pill (active / redeemed / expired / cancelled).
//
//   instagram  earned via story verification; the active state shows
//              the discount, the in-flight states call the user to
//              the next verification step.

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

  return (
    <article
      className={cn(
        "flex overflow-hidden rounded-2xl border",
        muted ? "border-border bg-card opacity-70" : "border-border bg-card",
      )}
    >
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

        {/* Instagram rejected coupons get a reason hint inline so the user
            knows what to fix on the retry. */}
        {isInstagram && c.status === "rejected" && c.rejectReason && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-2.5 py-1.5 text-[11px] leading-snug">
            {c.rejectReason}
          </p>
        )}
      </div>
    </article>
  );
}

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Instagram,
  X,
  type LucideIcon,
} from "lucide-react";

import type {
  InstagramCouponStatus,
  NormalCouponStatus,
} from "@/lib/mock/coupons-mock";

export type StatusMeta = {
  label: string;
  pillClass: string;
  Icon: LucideIcon;
  iconClass: string;
  banner: { tone: "info" | "warn" | "error" | "muted"; text: string } | null;
};

export const NORMAL_STATUS: Record<NormalCouponStatus, StatusMeta> = {
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
      text: "Already redeemed. Your discount was applied at the bill.",
    },
  },
  expired: {
    label: "Expired",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: Clock,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "This coupon expired. Save the place again to mint a fresh one.",
    },
  },
  cancelled: {
    label: "Cancelled",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: X,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "Cancelled. Tap the place to mint a new coupon.",
    },
  },
};

export const IG_STATUS: Record<InstagramCouponStatus, StatusMeta> = {
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
      text: "Already redeemed. Your discount was applied at the bill.",
    },
  },
  expired: {
    label: "Expired",
    pillClass: "border-border bg-muted text-muted-foreground",
    Icon: Clock,
    iconClass: "text-muted-foreground",
    banner: {
      tone: "muted",
      text: "This coupon expired. Save the place again to mint a fresh one.",
    },
  },
};

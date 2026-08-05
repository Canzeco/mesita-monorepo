"use client";

import Link from "next/link";
import { Instagram, MapPin, Share2, Ticket } from "lucide-react";
import type { CouponItem } from "@/lib/mock/coupons-mock";
import { toast } from "@/lib/toast";
import { placeHref } from "@/lib/place-route";

// Action cluster for coupon detail — View place / IG story / Show QR /
// Share. Coupons are scoped to "see where I can use it" + "what to do
// next" — the discount applies at the bill, the actual redemption
// happens at the place via QR scan.

export function CouponDetailActions({
  projectId,
  kind,
  status,
  muted,
}: {
  projectId: string;
  kind: CouponItem["kind"];
  status: CouponItem["status"];
  muted: boolean;
}) {
  const isInstagram = kind === "instagram";

  return (
    <section className="flex flex-col gap-2">
      <Link
        href={placeHref(projectId)}
        className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition"
      >
        <span className="flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">View place</span>
        </span>
        <span className="text-muted-foreground text-[12px]">
          Details, map, menu
        </span>
      </Link>

      {isInstagram && status === "pending_story" && (
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

      {!muted && kind === "normal" && status === "active" && (
        <button
          type="button"
          onClick={() =>
            toast.action(
              "QR redemption lands with the place scanner integration.",
              { label: "Notify me", onClick: () => {} },
            )
          }
          className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
        >
          <span className="flex items-center gap-3">
            <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
              <Ticket className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">Show at place</span>
          </span>
          <span className="text-muted-foreground text-[12px]">
            QR for the host
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={() =>
          toast.action("Sharing a coupon link with a friend lands soon.", {
            label: "Notify me",
            onClick: () => {},
          })
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
  );
}

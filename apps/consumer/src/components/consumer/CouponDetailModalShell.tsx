"use client";

import { Share2 } from "lucide-react";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";
import { toast } from "@/lib/toast";

// Content chrome for the intercepted /coupon/[id] route. The sliding panel
// (animation, backdrop, ESC, dismiss via router.back) is SlideOverShell,
// mounted from the segment's layout.tsx — this only fills it with header +
// scroll body. Coupon actions live inside the body (View place, Show at
// place, Share, Open Instagram), so no action bar row here.

export function CouponDetailModalShell({
  children,
  placeName,
}: {
  children: React.ReactNode;
  placeName: string;
}) {
  function onShare() {
    const shareData = {
      title: `${placeName} on Mesita`,
      text: `My coupon for ${placeName}`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      navigator.share(shareData).catch(() => {
        /* user cancelled */
      });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareData.url)
        .then(() => toast.success("Link copied to clipboard"))
        .catch(() => toast.error("Couldn't copy link"));
      return;
    }
    toast.error("Sharing isn't available in this browser");
  }

  return (
    <>
      <SlideOverHeader
        title="Coupon"
        actions={
          <button
            type="button"
            onClick={onShare}
            aria-label="Share"
            className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
          >
            <Share2 className="h-4 w-4" />
          </button>
        }
      />
      {/*
        `min-h-0` is load-bearing — without it the flex-1 child grows to
        fit content, `overflow-y-auto` never triggers, and the body
        scrolls on the outer shell instead. Same trap as
        PlaceDetailModalShell / ReservationDetailModalShell.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </>
  );
}

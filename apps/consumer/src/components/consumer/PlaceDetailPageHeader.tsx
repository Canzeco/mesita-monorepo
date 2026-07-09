"use client";

import Link from "next/link";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { PlaceNameWithVerification } from "@/components/consumer/PlaceVerificationIcon";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Header for the hard-nav /place/[id] page (refresh / direct URL / new
// tab). Mirrors the modal shell's header but with an ArrowLeft Link back
// to /discover/swipe instead of a router.back() X close — the modal can
// route home because there's always a previous shell route; the hard-nav
// page can't trust browser history.
//
// Instagram-profile chrome: back + place name + verification icon + ⋯.
// Save moved into the ProfileSummary buttons inside the body; the ⋯ menu
// has no options yet (share and friends land there when it opens).

export function PlaceDetailPageHeader({
  placeName,
  listingType,
  backHref = CONSUMER_ROUTES.home,
}: {
  placeName: string;
  listingType: "partner" | "web";
  backHref?: string;
}) {
  return (
    <header className="bg-background/85 z-20 flex shrink-0 items-center gap-2 px-3 py-3 backdrop-blur">
      <Link
        href={backHref}
        aria-label="Back"
        className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      {/* decision: Pato — place name a bit larger than default slide-over text-sm */}
      <div className="font-display flex min-w-0 flex-1 items-center justify-center text-base font-semibold">
        <PlaceNameWithVerification name={placeName} listingType={listingType} />
      </div>
      <PlaceMoreButton />
    </header>
  );
}

// Shared ⋯ button for both place-detail top bars. No menu behind it yet —
// the toast keeps the tap from reading as broken until options ship.
export function PlaceMoreButton() {
  return (
    <button
      type="button"
      onClick={() => toast("More options coming soon")}
      aria-label="More options"
      className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}

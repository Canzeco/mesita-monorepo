"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { PlaceSaveButton } from "@/components/consumer/PlaceSaveButton";

// Header for the hard-nav /place/[id] page (refresh / direct URL / new
// tab). Mirrors the modal shell's header but with an ArrowLeft Link back
// to /discover/swipe instead of a router.back() X close — the modal can
// route home because there's always a previous shell route; the hard-nav
// page can't trust browser history.
//
// decision: Pato (MESITA-383) — Save lives top-right in the header; the
// body action row is Contact · Reserve · Share.

export function PlaceDetailPageHeader({
  placeId,
  placeName,
  listingType: _listingType,
  backHref = CONSUMER_ROUTES.home,
}: {
  placeId: string;
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
      <div className="font-display min-w-0 flex-1 truncate text-center text-base font-semibold">
        {placeName}
      </div>
      <PlaceSaveButton placeId={placeId} placeName={placeName} />
    </header>
  );
}

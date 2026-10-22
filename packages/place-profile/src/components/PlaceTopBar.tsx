"use client";

import { ChevronLeft, MoreHorizontal } from "lucide-react";

import { inertButtonProps } from "../actions";
import { PlaceDetailTitle } from "./PlaceDetailTitle";

// THE PLACE SCREEN'S TOP BAR, ONE COMPONENT (MESITA-2627). Instagram's
// profile bar (Pato, MESITA-2619: "make the header look more instagramish,
// with the three dots"): a bare chevron, the name in bold sans at its left
// with the Enriched mark before it (MESITA-2624), and the three dots at the
// right edge that open the share sheet.
//
// Both ways a place opens draw THIS: PlaceProfile (the direct-link page and
// the admin phone) and the consumer's in-app slide-over
// (PlaceDetailModalShell). Until MESITA-2627 the slide-over kept its own
// header, a bordered back square and a centred serif name, so the guest saw
// the old bar every time they opened a place from inside the app.
//
// A missing callback leaves its button visible and inert.
export function PlaceTopBar({
  name,
  enriched,
  onBack,
  onShare,
}: {
  name: string;
  enriched: boolean;
  onBack?: () => void;
  onShare?: () => void;
}) {
  return (
    <header className="bg-card z-20 flex h-14 shrink-0 items-center gap-1 px-1">
      <button
        type="button"
        aria-label="Back"
        className="text-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
        {...(onBack ? { onClick: onBack } : inertButtonProps(false))}
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
      </button>
      <PlaceDetailTitle placeName={name} enriched={enriched} />
      <button
        type="button"
        aria-label="Share this place"
        className="text-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
        {...(onShare ? { onClick: onShare } : inertButtonProps(false))}
      >
        <MoreHorizontal className="h-6 w-6" strokeWidth={2.25} />
      </button>
    </header>
  );
}

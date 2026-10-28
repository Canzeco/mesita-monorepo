"use client";

import { ChevronLeft, MoreHorizontal } from "lucide-react";

import { inertButtonProps } from "../actions";
import { PlaceDetailTitle } from "./PlaceDetailTitle";

// THE PLACE SCREEN'S TOP BAR, ONE COMPONENT (MESITA-2627). Instagram's
// profile bar (Pato, MESITA-2619: "make the header look more instagramish,
// with the three dots"): a bare chevron, the name in bold sans at its left
// with the Official mark after it (MESITA-2925), and the three dots at the
// right edge. THE DOTS OPEN A MENU (Pato, MESITA-2692: "three dots in place
// profile is not only to report"): the host's sheet of the place's actions,
// Report last. They opened Report alone (MESITA-2684), and the share sheet
// before that.
//
// Both ways a place opens draw THIS: PlaceProfile (the direct-link page and
// the admin phone) and the consumer's in-app slide-over
// (PlaceDetailModalShell). Until MESITA-2627 the slide-over kept its own
// header, a bordered back square and a centred serif name, so the guest saw
// the old bar every time they opened a place from inside the app.
//
// A missing callback leaves its button visible and inert. A null name is
// the bar while the place loads (Pato, MESITA-2701: "the placeholders must
// be similar to the page you are loading, like the sizes"): this same bar,
// a bone where the name goes (PlaceTopBarSkeleton draws it so).
//
// `backOnly` is the bar before a place exists (MESITA-2935, the consumer's
// generating screen): the chevron alone, no name bone and no dots, since
// there is nothing yet to name or act on.
export function PlaceTopBar({
  name,
  officialTier = 0,
  onBack,
  onMore,
  backOnly = false,
}: {
  name: string | null;
  /** `boost_tier`; 1..3 draws "Official 2X" after the name (MESITA-2925). */
  officialTier?: number;
  onBack?: () => void;
  onMore?: () => void;
  /** Chevron only: no title, no menu (a place still being generated). */
  backOnly?: boolean;
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
      {backOnly ? null : (
        <>
          <PlaceDetailTitle placeName={name} officialTier={officialTier} />
          <button
            type="button"
            aria-label="More options"
            aria-haspopup="dialog"
            className="text-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
            {...(onMore ? { onClick: onMore } : inertButtonProps(false))}
          >
            <MoreHorizontal className="h-6 w-6" strokeWidth={2.25} />
          </button>
        </>
      )}
    </header>
  );
}

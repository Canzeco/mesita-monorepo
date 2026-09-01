"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PlaceDetailTitle } from "@/components/consumer/PlaceDetailTitle";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Header for the hard-nav /place/[id] page (refresh / direct URL / new tab).
// Mirrors the modal shell's header, but the modal closes with an X and this
// page goes BACK.
//
// decision: Pato (MESITA-392, reverses MESITA-383) — Save moved into the
// body action row (Save · Contact · Share since MESITA-1065). The header is
// just back + centered name now, so a w-9 spacer balances the back button.
//
// decision: Pato (MESITA-451, revised) — the "Enriching" state now lives as
// a chip in the profile summary (PlaceDetailBody), not to the right of the
// name in this header.
//
// decision: Pato (live, MESITA-1070) — "only the back arrow (it redirects to
// prev page, if not prev page, then to home)". This used to be a hard <Link>
// to /home/swipe, which is not what an arrow means: a guest who arrived from
// Search, Favorites or a reservation was silently relocated to a surface they
// hadn't asked for, and their scroll position on the one they came from was
// gone. Now it is a real history pop, with home as the fallback for the case
// where there IS no previous page — a shared link, a fresh tab, a refresh.

export function PlaceDetailPageHeader({
  placeId: _placeId,
  placeName,
  partner,
  fallbackHref = CONSUMER_ROUTES.search,
}: {
  placeId: string;
  placeName: string;
  partner: boolean;
  /** Where to land when there is no history to pop. */
  fallbackHref?: string;
}) {
  const router = useRouter();

  const onBack = useCallback(() => {
    // history.length is the honest test for "is there a previous page": it
    // counts entries for THIS tab, so a deep link opened cold reads 1 and a
    // guest who navigated here from anywhere in the app reads more. replace()
    // on the fallback so a dead-end arrival doesn't stack a second entry that
    // the system back gesture would then have to chew through.
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }, [router, fallbackHref]);

  return (
    <header className="bg-card z-20 flex shrink-0 items-center gap-2 px-3 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <PlaceDetailTitle placeName={placeName} partner={partner} />
      <div className="h-9 w-9 shrink-0" aria-hidden />
    </header>
  );
}

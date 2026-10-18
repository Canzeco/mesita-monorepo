"use client";

// Opening a Google-only result's full profile (MESITA-2298, MESITA-2307).
// The tap opens the profile AT ONCE: the card the guest already sees is
// stashed and the route /place/g:<googlePlaceId> draws it as the profile,
// Google's photo loading on the client, while PendingPlaceScreen runs and
// awaits consumer-web-create-place (get-or-create) — the ONE consumer action
// that creates a Mesita Place. Nothing here runs on render, on a pin tap,
// on scroll or on a prefetch; a card calls it from a deliberate tap only.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { type PendingPlaceCard, stashPendingPlace } from "@/lib/pending-place";
import { pendingPlaceHref } from "@/lib/place-route";

export type GoogleOnlyPlace = PendingPlaceCard & {
  slug?: string | null;
  google_place_id?: string | null;
};

/** The Google Place ID a Google-only row carries: the id, else the slug. */
export function googlePlaceIdOf(place: GoogleOnlyPlace): string | null {
  const gid = place.google_place_id ?? place.slug;
  return gid && gid.trim() ? gid : null;
}

export function useOpenGooglePlace(): (place: GoogleOnlyPlace) => void {
  const router = useRouter();
  return useCallback(
    (place: GoogleOnlyPlace) => {
      const gid = googlePlaceIdOf(place);
      if (!gid) return;
      stashPendingPlace(gid, place);
      router.push(pendingPlaceHref(gid));
    },
    [router],
  );
}

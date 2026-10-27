"use client";

import { useEffect, useState } from "react";
import { reconcileConsumerLocalOwner } from "@/lib/consumer-local-reset";
import { apiSavedActivity, apiTrackActivity } from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";
import { setSavedPlacesRemote, syncSavedPlaces } from "@/lib/saved-places";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot } from "@/lib/use-user-location";

// Mounted once at the top of the (shell) layout with the authenticated
// consumer id. Clears the browser's client-only consumer data (favorites,
// saved-place previews, draft reservations) whenever a different consumer owns
// the session — so a fresh account never inherits stale saves after a sign-out,
// an account switch, or an admin database reset. See
// consumer-local-reset.ts for the rationale.
//
// The reconcile runs in a useState initializer (not an effect) so the wipe
// lands during this component's render — before the children subtree that reads
// the saved set (Places' Favorites row) mounts and hydrates from storage.
// That avoids a one-frame flash of the previous consumer's places. The check is
// idempotent, so StrictMode's double-invoke in dev is harmless. The (shell)
// layout unmounts on every auth change (sign-out redirects out of the shell),
// so a fresh consumer id always arrives as a fresh mount.
//
// SAVED IS SERVER-SIDE (MESITA-2442): after the reconcile, the effect wires
// the write-through for every heart and adopts the server's saved set once
// per shell mount. The browser's set stays as the cache that paints first.
export function ConsumerLocalDataGuard({ consumerId }: { consumerId: string }) {
  useState(() => {
    reconcileConsumerLocalOwner(consumerId);
    return null;
  });
  const getSupabase = useLazyBrowserSupabase();
  useEffect(() => {
    const track = (placeId: string, on: boolean) =>
      // The device fix of the tap, if any: where the like happened
      // (MESITA-2853). The quiet backfill below carries none.
      apiTrackActivity(getSupabase(), {
        kind: "saved",
        placeId,
        on,
        at: locationSnapshot().coords,
      });
    setSavedPlacesRemote((placeId, on) => {
      void track(placeId, on).catch(() => {
        /* the cache keeps the tap; the next sync settles it */
      });
    });
    // The first sync's backfill writes QUIET saves: made when saves were
    // "only in this browser", they never reach the feed (MESITA-2460).
    void syncSavedPlaces<Place>(
      () => apiSavedActivity(getSupabase()),
      (placeId) =>
        apiTrackActivity(getSupabase(), {
          kind: "saved",
          placeId,
          quiet: true,
        }),
    );
    return () => setSavedPlacesRemote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consumerId]);
  return null;
}

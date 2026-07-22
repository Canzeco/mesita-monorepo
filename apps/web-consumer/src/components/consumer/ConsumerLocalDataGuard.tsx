"use client";

import { useState } from "react";
import { reconcileConsumerLocalOwner } from "@/lib/consumer-local-reset";

// Mounted once at the top of the (shell) layout with the authenticated
// consumer id. Clears the browser's client-only consumer data (favorites,
// saved-place previews, draft reservations) whenever a different consumer owns
// the session — so a fresh account never inherits stale saves after a sign-out,
// an account switch, or an `admin-web-reset-database` reset. See
// consumer-local-reset.ts for the rationale.
//
// The reconcile runs in a useState initializer (not an effect) so the wipe
// lands during this component's render — before the children subtree that reads
// the saved set (FavoritesList, SwipeDeck) mounts and hydrates from storage.
// That avoids a one-frame flash of the previous consumer's places. The check is
// idempotent, so StrictMode's double-invoke in dev is harmless. The (shell)
// layout unmounts on every auth change (sign-out redirects out of the shell),
// so a fresh consumer id always arrives as a fresh mount.
export function ConsumerLocalDataGuard({ consumerId }: { consumerId: string }) {
  useState(() => {
    reconcileConsumerLocalOwner(consumerId);
    return null;
  });
  return null;
}

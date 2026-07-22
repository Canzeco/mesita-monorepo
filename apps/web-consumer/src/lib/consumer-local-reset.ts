// Consumer-scoped local data reconciliation.
//
// Favorites (`mesita:saved-places` + `mesita:saved-place-previews`) and draft
// reservations (`mesita:reservations`) are stored in the browser — there is no
// EF behind them yet (see the consumer app CLAUDE.md: "Favorites = localStorage,
// not an EF"). Because that state lives in localStorage, it survives BOTH a
// consumer sign-out AND a server-side `admin-web-reset-database` wipe. So a
// second consumer signing in on the same browser — or the same operator
// re-creating an account after a reset — would otherwise inherit the previous
// consumer's saved places (stale rows from the old data).
//
// The fix is an ownership stamp: record which consumer the browser's client-only
// data belongs to, and wipe it whenever a different consumer owns the session.
// One check covers all three cases (reset, sign-out → new account, account
// switch) because they all surface the same way here — a consumer id that no
// longer matches the stamp.
//
// Device-level preferences (language, default city, permission + notification
// toggles) are deliberately NOT cleared: those belong to the browser/device, not
// to the account, so they should persist across sign-ins.

import { clearReservationsLocal } from "./reservations";
import { clearSavedPlacesLocal } from "./saved-places";

const OWNER_KEY = "mesita:consumer-owner";

// Reconcile the stored owner against the currently signed-in consumer. A no-op
// on the common path (same consumer re-mounting); on a mismatch it clears the
// consumer-scoped local stores and re-stamps the owner. Pass null for a
// signed-out browser (clears + drops the stamp). SSR-safe: no-ops without a
// window.
//
// First load after this ships: no stamp exists yet, so any pre-existing local
// favorites are cleared once — their provenance is unknown, so treating them as
// not-belonging-to-this-account is the safe default (and is exactly what a
// browser dirtied by an earlier reset needs). This is intentional; do not add a
// "grace" branch that adopts un-stamped data, or the cross-account/reset leak
// this guards against comes back on any already-dirty browser.
export function reconcileConsumerLocalOwner(consumerId: string | null): void {
  if (typeof window === "undefined") return;

  let owner: string | null;
  try {
    owner = window.localStorage.getItem(OWNER_KEY);
  } catch {
    return; // private mode / storage blocked — nothing we can reconcile
  }
  if (owner === consumerId) return;

  clearSavedPlacesLocal();
  clearReservationsLocal();

  try {
    if (consumerId) window.localStorage.setItem(OWNER_KEY, consumerId);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    /* best effort — the clear above already ran */
  }
}

// Local reservations cache clear — companion to clearSavedPlacesLocal.
// The booking UI talks to consumer-web-* reservation EFs now; this only
// drops any legacy localStorage key left from the old mock store when the
// signed-in consumer changes (consumer-local-reset).

const STORAGE_KEY = "mesita:reservations";

export function clearReservationsLocal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — nothing to clear */
  }
}

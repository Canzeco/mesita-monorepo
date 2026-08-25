// Header chips and the Admin Verification box both read ownership proof.
// After the operator decides a queue row, bump this so every listener
// re-reads admin-web-get-place-verification without lifting that glance
// onto PlaceContext.

export const PLACE_VERIFICATION_CHANGED = "mesita:place-verification-changed";

export function notifyPlaceVerificationChanged(placeId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PLACE_VERIFICATION_CHANGED, { detail: { placeId } }),
  );
}

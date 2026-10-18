// A Google-only profile the guest opened has landed on Mesita (MESITA-2307).
// PendingPlaceScreen says so here; the Feed, mounted under the place modal,
// reloads its rails on it so the card comes back as the Mesita card.

export const PLACE_CREATED_EVENT = "mesita:place-created";

export type PlaceCreatedDetail = {
  googlePlaceId: string;
  /** The real profile's route. */
  href: string;
  created: boolean;
};

export function emitPlaceCreated(detail: PlaceCreatedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PlaceCreatedDetail>(PLACE_CREATED_EVENT, { detail }),
  );
}

/** Subscribe; returns the unsubscribe. */
export function onPlaceCreated(
  handler: (detail: PlaceCreatedDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<PlaceCreatedDetail>).detail);
  };
  window.addEventListener(PLACE_CREATED_EVENT, listener);
  return () => window.removeEventListener(PLACE_CREATED_EVENT, listener);
}

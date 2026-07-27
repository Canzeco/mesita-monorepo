// Cross-component seam: the Swipe deck's "Saved · View" toast asks the Home
// hub to switch to its Favorites segment (web parity — web pushes
// CONSUMER_ROUTES.favorites). On mobile the Home mode is LOCAL state inside
// app/(tabs)/home.tsx (Swipe/Favorites are segments, not routes), so there is
// no expo-router target to push. This tiny module-level emitter lets the toast
// REQUEST the switch and lets the Home screen fulfil it with a one-line
// subscription. Until a subscriber is attached the request is a safe no-op.
//
// FOLLOW-UP (outside this package's allowlist): app/(tabs)/home.tsx should
// subscribe once —
//   useEffect(() => subscribeHomeMode((m) => m === 'favorites' && setMode('favorites')), []);
// which completes the "View" jump. Everything else here is self-contained.

type HomeMode = 'favorites';

const listeners = new Set<(mode: HomeMode) => void>();

/** Ask the Home hub to switch to a segment (currently only Favorites). */
export function requestHomeMode(mode: HomeMode): void {
  for (const listener of listeners) listener(mode);
}

/** Home screen subscribes to fulfil requests; returns an unsubscribe. */
export function subscribeHomeMode(cb: (mode: HomeMode) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

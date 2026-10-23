// The operator's current-location radius (MESITA-2703): the circle Home
// searches around the device, and around a pin saved without a radius. It
// is the server's number (`map.radiusKm`, Admin › Discovery › Area); every
// catalog answer carries it, and this keeps the last one for the tab, so the
// location sheet can say "Current location · 15 km" and the pin picker can
// offer it as a chip. 15 km until the first answer lands.

import { useSyncExternalStore } from "react";

export const OPERATOR_RADIUS_KM_DEFAULT = 15;

let current = OPERATOR_RADIUS_KM_DEFAULT;
const listeners = new Set<() => void>();

export function rememberOperatorRadiusKm(km: number): void {
  if (!Number.isFinite(km) || km <= 0 || km === current) return;
  current = Math.round(km * 10) / 10;
  for (const l of listeners) l();
}

export function getOperatorRadiusKm(): number {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOperatorRadiusKm(): number {
  return useSyncExternalStore(subscribe, getOperatorRadiusKm, () => OPERATOR_RADIUS_KM_DEFAULT);
}

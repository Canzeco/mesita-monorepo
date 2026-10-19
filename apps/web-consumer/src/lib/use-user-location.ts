"use client";

import { useCallback, useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60_000,
};

let coordsState: Coords | null = null;
let locatingState = false;
let asked = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function requestUserLocation(): Promise<Coords | null> {
  asked = true;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    emit();
    return Promise.resolve(null);
  }
  locatingState = true;
  emit();
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsState = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        locatingState = false;
        emit();
        resolve(coordsState);
      },
      () => {
        locatingState = false;
        emit();
        resolve(null);
      },
      GEO_OPTS,
    );
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUserLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(coordsState);

  useEffect(() => subscribe(() => setCoords(coordsState)), []);

  useEffect(() => {
    if (asked) return;
    void requestUserLocation();
  }, []);

  return coords;
}

export function useUserLocationLocating(): boolean {
  const [locating, setLocating] = useState(locatingState);
  useEffect(() => subscribe(() => setLocating(locatingState)), []);
  return locating;
}

/** True once the first ask has answered (a fix, a refusal or no
 *  geolocation at all): before that, no fix means "not yet", not "none". */
export function useUserLocationSettled(): boolean {
  const read = () => asked && !locatingState;
  const [settled, setSettled] = useState(read);
  useEffect(() => subscribe(() => setSettled(read())), []);
  return settled;
}

export function useLocateUser(): () => void {
  return useCallback(() => {
    void requestUserLocation();
  }, []);
}

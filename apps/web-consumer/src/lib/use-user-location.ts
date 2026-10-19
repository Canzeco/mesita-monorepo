"use client";

import { useCallback, useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };

/** Why the last ask brought no fix (MESITA-2437): the browser blocked the
 *  site (1), the device could not find itself (2, e.g. a Mac whose Location
 *  Services are off for the browser), it took too long (3), or there is no
 *  geolocation at all. A dropped error read as a dead button. */
export type LocationError = "denied" | "unavailable" | "timeout" | "unsupported";

/** GeolocationPositionError.code → our reason. */
export function locationErrorFromCode(code: number): LocationError {
  return code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable";
}

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60_000,
};

let coordsState: Coords | null = null;
let locatingState = false;
let errorState: LocationError | null = null;
let asked = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function requestUserLocation(): Promise<Coords | null> {
  asked = true;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    errorState = "unsupported";
    emit();
    return Promise.resolve(null);
  }
  locatingState = true;
  errorState = null;
  emit();
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsState = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        locatingState = false;
        errorState = null;
        emit();
        resolve(coordsState);
      },
      (err) => {
        locatingState = false;
        errorState = locationErrorFromCode(err.code);
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

/** The last ask's failure, or null (none yet, or a fix). */
export function useUserLocationError(): LocationError | null {
  const [error, setError] = useState(errorState);
  useEffect(() => subscribe(() => setError(errorState)), []);
  return error;
}

export function useLocateUser(): () => void {
  return useCallback(() => {
    void requestUserLocation();
  }, []);
}

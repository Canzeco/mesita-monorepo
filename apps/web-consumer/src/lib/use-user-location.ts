"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Coords = { lat: number; lng: number };

/** Why the last ask brought no fix (MESITA-2437): the browser blocked the
 *  site (1), the device could not find itself (2, e.g. a Mac whose Location
 *  Services are off for the browser), it took too long (3), or there is no
 *  geolocation at all. A dropped error read as a dead button. */
export type LocationError =
  "denied" | "unavailable" | "timeout" | "unsupported";

/** GeolocationPositionError.code → our reason. */
export function locationErrorFromCode(code: number): LocationError {
  return code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable";
}

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60_000,
};

/** The one retry after "unavailable" or "timeout" (MESITA-2615): any cached
 *  fix will do, and the device gets longer to find itself. */
const RETRY_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15_000,
  maximumAge: Infinity,
};

let coordsState: Coords | null = null;
let locatingState = false;
let errorState: LocationError | null = null;
let asked = false;
let inflight: Promise<Coords | null> | null = null;
let watchingPermission = false;
const listeners = new Set<() => void>();
// Every fix the browser hands back, the same coordinates included: a page
// that asked for a fix (the Search location disc) needs the answer even
// when the guest has not moved (MESITA-2440).
const fixListeners = new Set<(coords: Coords) => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function sameCoords(a: Coords | null, b: Coords | null): boolean {
  if (!a || !b) return a === b;
  return a.lat === b.lat && a.lng === b.lng;
}

/** One browser ask: the position, or the reason it failed. */
function askOnce(
  opts: PositionOptions,
): Promise<{ pos: GeolocationPosition } | { error: LocationError }> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ pos }),
      (err) => resolve({ error: locationErrorFromCode(err.code) }),
      opts,
    );
  });
}

/** ALLOWED LATER, LOCATED AT ONCE (MESITA-2615). A guest who unblocks the
 *  site from the browser's address bar should not have to reload or tap
 *  again: when the permission turns to "granted", ask. Browsers without the
 *  Permissions API for geolocation just skip this. */
function watchPermission() {
  if (watchingPermission) return;
  watchingPermission = true;
  try {
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        status.addEventListener("change", () => {
          if (status.state === "granted" && !coordsState) void requestUserLocation();
        });
      })
      .catch(() => {});
  } catch {
    // No Permissions API: the guest taps "Use my location" again instead.
  }
}

function requestUserLocation(): Promise<Coords | null> {
  asked = true;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    errorState = "unsupported";
    emit();
    return Promise.resolve(null);
  }
  watchPermission();
  // One ask at a time: a second caller waits on the same answer.
  if (inflight) return inflight;
  locatingState = true;
  errorState = null;
  emit();
  inflight = (async () => {
    let answer = await askOnce(GEO_OPTS);
    // The device could not find itself or took too long: once more, longer,
    // taking any cached fix (MESITA-2615). A refusal is final; no retry.
    if ("error" in answer && (answer.error === "unavailable" || answer.error === "timeout")) {
      answer = await askOnce(RETRY_OPTS);
    }
    inflight = null;
    locatingState = false;
    if ("error" in answer) {
      errorState = answer.error;
      emit();
      return null;
    }
    const next = {
      lat: answer.pos.coords.latitude,
      lng: answer.pos.coords.longitude,
    };
    // SAME PLACE, SAME OBJECT (MESITA-2440). A fresh object for the same
    // coordinates read as a move to every effect keyed on it: the Search
    // map re-centred on the guest after they had panned away.
    const fix = coordsState && sameCoords(coordsState, next) ? coordsState : next;
    coordsState = fix;
    errorState = null;
    emit();
    for (const listener of fixListeners) listener(fix);
    return fix;
  })();
  return inflight;
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

/** Call `onFix` with every fix that lands from now on. The callback runs
 *  from the browser's answer, not from a render, so it may set state. */
export function useOnUserFix(onFix: (coords: Coords) => void): void {
  const latest = useRef(onFix);
  useEffect(() => {
    latest.current = onFix;
  }, [onFix]);
  useEffect(() => {
    const listener = (coords: Coords) => latest.current(coords);
    fixListeners.add(listener);
    return () => {
      fixListeners.delete(listener);
    };
  }, []);
}

"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type Coords = { lat: number; lng: number };

/** Why the last ask brought no fix (MESITA-2437): the browser blocked the
 *  site (1), the device could not find itself (2, e.g. a Mac whose Location
 *  Services are off for the browser), it took too long (3), there is no
 *  geolocation at all, or the browser is still waiting on its "allow
 *  location?" prompt (MESITA-2616). A dropped error read as a dead button. */
export type LocationError =
  "denied" | "unavailable" | "timeout" | "unsupported" | "pending";

/** NEVER HANG ON THE PROMPT (MESITA-2616). While the browser's permission
 *  prompt waits for the guest, `getCurrentPosition` does not answer at all
 *  (its timeout starts only after permission), and Home waited for that
 *  answer with a skeleton forever. After this long with no answer the ask
 *  counts as answered ("pending"); the real answer still wins when it lands. */
const STALL_MS = 5000;

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
// The fix came from the network, not the device (MESITA-2625).
let approxState = false;
let networkAsk: Promise<Coords | null> | null = null;
let locatingState = false;
let errorState: LocationError | null = null;
let asked = false;
let inflight: Promise<Coords | null> | null = null;
// Which ask is the newest (MESITA-2617): only it may report a failure.
let generation = 0;
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
          if (status.state === "granted" && (!coordsState || approxState)) {
            void requestUserLocation();
          }
        });
      })
      .catch(() => {});
  } catch {
    // No Permissions API: the guest taps "Use my location" again instead.
  }
}

/** LOCATION IS AUTOMATIC (MESITA-2625). The network's approximate point,
 *  from Vercel's IP geolocation via `/api/ip-location`: asked once per page,
 *  in parallel with the first device ask, so it is ready the moment the
 *  device gives nothing (a browser that denies geolocation outright, like
 *  the Claude desktop app's built-in one, a Mac with Location Services off,
 *  an unanswered prompt). Null when the server has no geo headers. */
function askNetwork(): Promise<Coords | null> {
  if (networkAsk) return networkAsk;
  if (typeof fetch === "undefined" || typeof window === "undefined") {
    return Promise.resolve(null);
  }
  networkAsk = fetch("/api/ip-location", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<{ coords?: unknown }>) : null))
    .then((body) => {
      const c = body?.coords as { lat?: unknown; lng?: unknown } | null | undefined;
      return c && typeof c.lat === "number" && typeof c.lng === "number"
        ? { lat: c.lat, lng: c.lng }
        : null;
    })
    .catch(() => null);
  return networkAsk;
}

/** The device gave no fix (`reason`): keep locating until the network
 *  answers, then take its point as an approximate fix if there is no fix
 *  yet. Only the newest ask may end "locating" or report the reason. */
function deviceGaveNothing(reason: LocationError, gen: number) {
  if (gen === generation) errorState = reason;
  void askNetwork().then((point) => {
    if (point && !coordsState) {
      coordsState = point;
      approxState = true;
      if (gen === generation) locatingState = false;
      emit();
      for (const listener of fixListeners) listener(point);
      return;
    }
    if (gen === generation) locatingState = false;
    emit();
  });
}

/** The store as the hooks read it. */
export function locationSnapshot(): {
  coords: Coords | null;
  approx: boolean;
  locating: boolean;
  settled: boolean;
  error: LocationError | null;
} {
  return {
    coords: coordsState,
    approx: approxState,
    locating: locatingState,
    settled: asked && !locatingState,
    error: errorState,
  };
}

export function requestUserLocation(): Promise<Coords | null> {
  asked = true;
  void askNetwork();
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    const gen = ++generation;
    locatingState = true;
    emit();
    deviceGaveNothing("unsupported", gen);
    return Promise.resolve(null);
  }
  watchPermission();
  // One live ask at a time: a second caller waits on the same answer. A
  // STALLED ask is not live (MESITA-2617): a tap after the cap asks the
  // browser again instead of joining an ask that may never answer.
  if (inflight && locatingState) return inflight;
  const gen = ++generation;
  locatingState = true;
  errorState = null;
  emit();
  // The cap covers the whole ask, the retry included (MESITA-2617).
  const stall = setTimeout(() => {
    if (gen !== generation || !locatingState) return;
    deviceGaveNothing("pending", gen);
  }, STALL_MS);
  const run: Promise<Coords | null> = (async () => {
    let answer = await askOnce(GEO_OPTS);
    // The device could not find itself or took too long: once more, longer,
    // taking any cached fix (MESITA-2615). A refusal is final; no retry.
    if ("error" in answer && (answer.error === "unavailable" || answer.error === "timeout")) {
      answer = await askOnce(RETRY_OPTS);
    }
    clearTimeout(stall);
    if (gen === generation) inflight = null;
    if ("error" in answer) {
      // Only the newest ask speaks for failure; an older one is stale.
      if (gen === generation) deviceGaveNothing(answer.error, gen);
      return null;
    }
    // A device fix from any ask, old or new, wins, over the network's too.
    locatingState = false;
    approxState = false;
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
  inflight = run;
  return run;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// EVERY READ THROUGH useSyncExternalStore (MESITA-2616). The hooks used to
// copy the store into useState at render and subscribe in an effect; the
// first ask (started by useUserLocation's own effect) emitted before the
// sibling hooks subscribed, so they kept "not asked": the box read "Use my
// location" while the browser was in fact locating.
const serverNull = () => null;
const serverFalse = () => false;

export function useUserLocation(): Coords | null {
  const coords = useSyncExternalStore(subscribe, () => locationSnapshot().coords, serverNull);

  useEffect(() => {
    if (asked) return;
    void requestUserLocation();
  }, []);

  return coords;
}

export function useUserLocationLocating(): boolean {
  return useSyncExternalStore(subscribe, () => locationSnapshot().locating, serverFalse);
}

/** True once the first ask has answered (a fix, a refusal, no geolocation
 *  at all, or no answer within STALL_MS): before that, no fix means "not
 *  yet", not "none". */
export function useUserLocationSettled(): boolean {
  return useSyncExternalStore(subscribe, () => locationSnapshot().settled, serverFalse);
}

/** The last ask's failure, or null (none yet, or a fix). */
export function useUserLocationError(): LocationError | null {
  return useSyncExternalStore(subscribe, () => locationSnapshot().error, serverNull);
}

/** True while the fix is the network's approximate point (MESITA-2625). */
export function useUserLocationApprox(): boolean {
  return useSyncExternalStore(subscribe, () => locationSnapshot().approx, serverFalse);
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

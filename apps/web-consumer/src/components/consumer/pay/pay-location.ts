"use client";

import { useEffect, useState } from "react";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";

// THE PAY LOCATION (MESITA-3457, split out of PayPage in MESITA-4232): the
// fix the places read carries, rounded to 3 decimals (~110 m) and sent only
// to that read. The picker (/pay/pick) asks for it after a priming card;
// /pay itself never asks, it only uses a fix the browser already grants, so
// Pay Bill can name the place the guest is at (MESITA-4232, D5).

/** The location the list read carries, in decimals (~110 m). The server's
 *  twin is LOCATION_DECIMALS in _shared/pay-places.ts. */
const LOCATION_DECIMALS = 3;
/** "Not now" on the location card holds for this browser session. */
const LOCATION_NOT_NOW_KEY = "mesita.pay.location-not-now";

const round = (v: number) => Math.round(v * 10 ** LOCATION_DECIMALS) / 10 ** LOCATION_DECIMALS;

export type Loc =
  | { state: "unknown" }
  | { state: "prime" }
  | { state: "asking" }
  | { state: "blocked" }
  | { state: "off" }
  | { state: "on"; at: { lat: number; lng: number } };

function readNotNow(): boolean {
  try {
    return window.sessionStorage.getItem(LOCATION_NOT_NOW_KEY) === "1";
  } catch {
    return false;
  }
}

/** `prime`: may show the priming card and ask (the picker). Without it the
 *  hook only reads a fix already in hand or already granted (Pay). */
export function usePayLocation({ prime }: { prime: boolean }): {
  loc: Loc;
  askLocation: () => void;
  notNow: () => void;
} {
  const [loc, setLoc] = useState<Loc>({ state: "unknown" });

  // A fix already in hand is used; a granted permission is asked at once;
  // otherwise the picker's priming card asks first, and Pay stays off.
  useEffect(() => {
    let cancelled = false;
    const have = locationSnapshot().coords;
    const idle = (): Loc => (prime && !readNotNow() ? { state: "prime" } : { state: "off" });
    const ask = () => {
      setLoc({ state: "asking" });
      void requestUserLocation().then((c) => {
        if (cancelled) return;
        if (c) setLoc({ state: "on", at: { lat: round(c.lat), lng: round(c.lng) } });
        else setLoc({ state: locationSnapshot().error === "denied" ? "blocked" : "off" });
      });
    };
    if (have) {
      // Deferred a tick: no state is set inside the effect's own body.
      void Promise.resolve().then(() => {
        if (!cancelled) setLoc({ state: "on", at: { lat: round(have.lat), lng: round(have.lng) } });
      });
    } else if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((s) => {
          if (cancelled) return;
          if (s.state === "granted") ask();
          else if (s.state === "denied") setLoc({ state: prime ? "blocked" : "off" });
          else setLoc(idle());
        })
        .catch(() => {
          if (!cancelled) setLoc(idle());
        });
    } else {
      void Promise.resolve().then(() => {
        if (!cancelled) setLoc(idle());
      });
    }
    return () => {
      cancelled = true;
    };
  }, [prime]);

  function askLocation() {
    setLoc({ state: "asking" });
    void requestUserLocation().then((c) => {
      if (c) setLoc({ state: "on", at: { lat: round(c.lat), lng: round(c.lng) } });
      else setLoc({ state: locationSnapshot().error === "denied" ? "blocked" : "off" });
    });
  }

  function notNow() {
    try {
      window.sessionStorage.setItem(LOCATION_NOT_NOW_KEY, "1");
    } catch {
      // Private mode: the card comes back next visit, nothing else breaks.
    }
    setLoc({ state: "off" });
  }

  return { loc, askLocation, notNow };
}

/** "350 m" / "2.4 km". */
export function distanceText(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}

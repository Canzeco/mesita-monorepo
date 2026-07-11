"use client";

import { useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };

// One-shot consumer geolocation. Requests the browser position once on
// mount and returns it, or stays null when geolocation is unsupported,
// denied, or times out — callers must treat null as "no location" and
// degrade gracefully (e.g. hide the distance chip) rather than block.
//
// Mirrors the options used by ConsumerDiscoverMap so the two surfaces
// prompt identically: low-accuracy is plenty for a "how far" signal, an
// 8s timeout keeps us from hanging, and a 60s cache reuses a recent fix
// instead of re-prompting on every navigation.
export function useUserLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Denied / unavailable / timed out — leave coords null. The card
        // keeps whatever distance it already had (or hides the chip).
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}

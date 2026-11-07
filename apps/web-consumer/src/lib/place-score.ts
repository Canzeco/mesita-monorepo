"use client";

// THE PLACE SCREEN'S SCORE (MESITA-3319, Pato: "hide the scores ... at the
// bottom of stats write in overview that shit. call it Score"). The Home
// tile wore the server's ranking breakdown on its photo (MESITA-3053); it
// lives on the place screen's Overview now, under Stats. The numbers stay
// the server's (MESITA-2379): this asks consumer-web-list-catalog for this
// one card, scored from the guest's fix, else Home's chosen saved location,
// and hands `area` to the place as `score`. No location, no answer, or a
// card the catalog does not show (gated, gone): no score, no box. Nothing
// is computed in the browser.

import { useEffect, useState } from "react";
import type { PlaceDetail, PlaceScore } from "@mesita/place-profile";
import { apiFillAreaPool } from "@/lib/api/places";
import { useActiveLocation } from "@/lib/active-location";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useUserLocation } from "@/lib/use-user-location";

export function usePlaceScore<T extends Pick<PlaceDetail, "id">>(place: T): T & { score?: PlaceScore | null } {
  const supabase = useBrowserSupabase();
  const fix = useUserLocation();
  const active = useActiveLocation();
  const lat = fix?.lat ?? active?.lat ?? null;
  const lng = fix ? fix.lng : (active?.lng ?? null);
  const [score, setScore] = useState<{ id: string; at: string; value: PlaceScore | null } | null>(null);
  const at = lat != null && lng != null ? `${lat},${lng}` : "";

  useEffect(() => {
    if (!at) return;
    let live = true;
    const [la, ln] = at.split(",").map(Number);
    apiFillAreaPool(supabase, { lat: la, lng: ln }, [], [place.id])
      .then((rows) => {
        if (!live) return;
        const a = rows.find((r) => r.id === place.id)?.area;
        setScore({
          id: place.id,
          at,
          value: a
            ? {
                proximity: a.signals.proximity,
                distance_km: a.distanceKm ?? null,
                popularity: a.signals.popularity,
                premier: a.selectedFactor ?? 1,
                final: a.final,
              }
            : null,
        });
      })
      .catch(() => {
        if (live) setScore({ id: place.id, at, value: null });
      });
    return () => {
      live = false;
    };
  }, [supabase, place.id, at]);

  const value = score && score.id === place.id && score.at === at ? score.value : null;
  return value ? { ...place, score: value } : place;
}

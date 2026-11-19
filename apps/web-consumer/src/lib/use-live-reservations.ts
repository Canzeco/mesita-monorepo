"use client";

// THE GUEST'S LIVE TABLES, BY PLACE (MESITA-4453): one
// consumer-web-list-reservations read (upcoming = pending or confirmed, slot
// within the 4h grace) for a whole list of places, kept in the screen cache
// so Home's rows wear their badge at once on the way back. A guest holds at
// most one live table per place (MESITA-3640). Signed out, or a failed read:
// no tables, no badges.

import { useMemo } from "react";
import { apiListReservations } from "@/lib/api/reservations";
import { useViewer } from "@/lib/identity-context";
import { whenLine } from "@/lib/reservation-when";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";

export const LIVE_RESERVATIONS_KEY = "live-reservations";

/** A live table as a card shows it. */
export type LiveTable = {
  /** "Thu 19 · 20:00" on the place's clock. */
  when: string;
  confirmed: boolean;
};

export function useLiveReservations(): ReadonlyMap<string, LiveTable> {
  const supabase = useBrowserSupabase();
  const signedIn = useViewer() !== "anonymous";
  const { data } = useCachedQuery(
    signedIn ? LIVE_RESERVATIONS_KEY : null,
    () =>
      apiListReservations(supabase, { scope: "upcoming", limit: 100 }).then(
        (r) => r.reservations,
      ),
    { ttl: 60_000 },
  );
  return useMemo(() => {
    const byPlace = new Map<string, LiveTable>();
    for (const row of data ?? []) {
      const placeId = row.place?.id;
      if (!placeId || byPlace.has(placeId)) continue;
      // "Thu 19 Nov · 20:00" → "Thu 19 · 20:00": half a phone card is narrow.
      const [day = "", time = ""] = whenLine(row.reserved_at, row.place?.timezone || null).split(" · ");
      const short = day.split(" ").slice(0, 2).join(" ");
      byPlace.set(placeId, {
        when: time ? `${short} · ${time}` : short,
        confirmed: toReservationItem(row).state === "confirmed",
      });
    }
    return byPlace;
  }, [data]);
}

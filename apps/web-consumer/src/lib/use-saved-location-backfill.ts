"use client";

// Names saved pins that have none yet (MESITA-2501): an entry saved while
// Google was still answering, past the picker's call budget, or stored by a
// build from before confirmed pins (`needsName`), and Google-made names
// older than 30 days (its terms allow only temporary caching; the guest's
// own `customName` never expires). Mounted once, in Home's header.
//
// One call per entry at a time, written in place (a backfill never reorders
// the list). A transient failure tries once more this page load; an operator
// failure (the key, the session) leaves the entry for a later visit; a
// terminal one (Google has no name here) stops asking.

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReverseGeocodePin } from "@/lib/api/place-search";
import { classifyThrown } from "@/lib/pin-picker-state";
import {
  patchSavedLocationInPlace,
  SAVED_NAME_TTL_MS,
  useSavedLocations,
  type SavedLocation,
} from "@/lib/saved-locations";
import { useBrowserSupabase } from "@/lib/supabase/browser";

/** True when this entry's Google-made names should be fetched again. */
export function needsBackfill(l: SavedLocation, now: number): boolean {
  if (l.needsName) return true;
  return l.namedAt === null || now - l.namedAt > SAVED_NAME_TTL_MS;
}

/** The wait before a transient failure's one retry. */
export const BACKFILL_RETRY_MS = 15_000;

/** Pins (entry id + where it stands) already asked about this page load: a
 *  moved pin is a new question. */
const started = new Set<string>();
const startKey = (l: SavedLocation) => `${l.id}@${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;

/** Fetch one entry's names; `retry` is spent by a transient failure. */
export async function backfillSavedLocation(
  supabase: SupabaseClient,
  entry: SavedLocation,
  retry = true,
): Promise<void> {
  try {
    const names = await apiReverseGeocodePin(supabase, { lat: entry.lat, lng: entry.lng });
    patchSavedLocationInPlace(entry.id, {
      // The guest's edited name is never overwritten; the street always
      // follows the pin.
      ...(entry.nameEdited ? {} : { suggestedName: names.suggestedName }),
      formattedAddress: names.formattedAddress,
      needsName: false,
      namedAt: Date.now(),
    });
  } catch (err) {
    const failure = classifyThrown(err);
    if (failure === "terminal") {
      patchSavedLocationInPlace(entry.id, { needsName: false, namedAt: Date.now() });
    } else if (failure === "transient" && retry) {
      await new Promise((r) => setTimeout(r, BACKFILL_RETRY_MS));
      await backfillSavedLocation(supabase, entry, false);
    }
    // operator: left as it is until a later visit.
  }
}

export function useSavedLocationBackfill(): void {
  const supabase = useBrowserSupabase();
  const saved = useSavedLocations();

  useEffect(() => {
    const now = Date.now();
    for (const entry of saved) {
      if (started.has(startKey(entry)) || !needsBackfill(entry, now)) continue;
      started.add(startKey(entry));
      void backfillSavedLocation(supabase, entry);
    }
  }, [supabase, saved]);
}

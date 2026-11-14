// The Google-only open ledger (MESITA-2323): every explicit open of a
// Google-only result through consumer-web-create-place, with its outcome,
// and the summary Configurations › Creation reads.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const PLACE_OPEN_OUTCOMES = [
  "existing",
  "created",
  "refused",
  "failed",
] as const;
export type PlaceOpenOutcome = (typeof PLACE_OPEN_OUTCOMES)[number];

export type PlaceOpenRecord = {
  googlePlaceId: string;
  consumerId: string | null;
  outcome: PlaceOpenOutcome;
  placeId?: string | null;
  code?: string | null;
  caller: string;
};

/** Best effort: a ledger miss is logged and never fails the open. */
export async function recordPlaceOpen(
  admin: SupabaseClient,
  rec: PlaceOpenRecord,
): Promise<void> {
  try {
    const { error } = await admin.from("place_open_events").insert({
      google_place_id: rec.googlePlaceId,
      consumer_id: rec.consumerId,
      outcome: rec.outcome,
      place_id: rec.placeId ?? null,
      code: rec.code ?? null,
      caller: rec.caller,
    });
    if (error) console.error("[place-open-events] insert:", error.message);
  } catch (err) {
    console.error(
      "[place-open-events] insert threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

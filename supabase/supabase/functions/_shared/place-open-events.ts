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

export type PlaceOpenRow = {
  google_place_id: string;
  outcome: string;
  place_id: string | null;
};

export type PlaceOpenSummary = {
  opens: number;
  byOutcome: Record<PlaceOpenOutcome, number>;
  /** Distinct Google places opened. */
  places: number;
  /** Opens that ended on a Mesita profile (existing + created) / opens. */
  profileRate: number;
  /** Places opened more than once, most opened first. */
  repeated: Array<{
    googlePlaceId: string;
    opens: number;
    created: boolean;
    placeId: string | null;
  }>;
};

/** Pure: the summary of a window of ledger rows. */
export function summarizePlaceOpens(
  rows: readonly PlaceOpenRow[],
  top = 10,
): PlaceOpenSummary {
  const byOutcome: Record<PlaceOpenOutcome, number> = {
    existing: 0,
    created: 0,
    refused: 0,
    failed: 0,
  };
  const perPlace = new Map<
    string,
    { opens: number; created: boolean; placeId: string | null }
  >();
  for (const row of rows) {
    const outcome = (PLACE_OPEN_OUTCOMES as readonly string[]).includes(row.outcome)
      ? (row.outcome as PlaceOpenOutcome)
      : "failed";
    byOutcome[outcome] += 1;
    const p = perPlace.get(row.google_place_id) ??
      { opens: 0, created: false, placeId: null };
    p.opens += 1;
    if (outcome === "created") p.created = true;
    if (row.place_id) p.placeId = row.place_id;
    perPlace.set(row.google_place_id, p);
  }
  const opens = rows.length;
  const repeated = [...perPlace.entries()]
    .filter(([, p]) => p.opens > 1)
    .sort((a, b) => b[1].opens - a[1].opens || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([googlePlaceId, p]) => ({ googlePlaceId, ...p }));
  return {
    opens,
    byOutcome,
    places: perPlace.size,
    profileRate: opens > 0 ? (byOutcome.existing + byOutcome.created) / opens : 0,
    repeated,
  };
}

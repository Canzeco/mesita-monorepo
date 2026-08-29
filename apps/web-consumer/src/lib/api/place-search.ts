// Frontend API surface for the Search page — live catalog text search +
// the consumer "Add to Mesita" create flow.
//
// Architectural constraints honoured (same as places.ts):
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper calls exactly one Edge Function.
//
// apiSuggestPlaces already lives in ./places (it backs the search add-place
// picker); re-exported here so the Search surface has a single import
// site for both halves of its search→add pipeline.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export { apiSuggestPlaces, type PlacePrediction, type SuggestPlacesMode } from "./places";

type CreatedProject = {
  ok: boolean;
  /** The freshly created ugly profile (ready, not Enriched). */
  place: { id: string; slug: string; name: string; status: string };
};

/**
 * Create a Google-only search result on Mesita immediately.
 *
 * Calls consumer-web-create-place, which runs Create only (dedupe → Google
 * spine → ready row, enriched_at null). Intaker is not queued. The place
 * modal opens on the Enrich vote tab until the Intake threshold is hit.
 */
export async function apiCreateProject(
  client: SupabaseClient,
  input: { placeId: string },
): Promise<CreatedProject> {
  // `googlePlaceId` on the wire: `placeId` is reserved for place-row UUIDs
  // platform-wide (MESITA-51 addendum 9).
  return invokeEF<CreatedProject>(
    client,
    "consumer-web-create-place",
    { googlePlaceId: input.placeId },
    "Couldn't add that place right now.",
  );
}

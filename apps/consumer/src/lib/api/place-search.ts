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

export {
  apiSuggestPlaces,
  type PlacePrediction,
  type PlacePredictionStatus,
} from "./places";

export type CreatedProject = {
  ok: boolean;
  /** The freshly created place row (content_status='generating'). */
  place: { id: string; slug: string; name: string; status: string };
};

/**
 * Create a Google-only search result on Mesita immediately.
 *
 * Calls consumer-web-create-project, which runs the shared create core
 * inline (dedupe → Google spine → 'generating' rows → seed place_research);
 * the cron-driven Enricher pipeline then enriches asynchronously. The place
 * lands with content_status='generating' and flips to 'ready' once enriched
 * — typically within ~5 minutes — so the UI should show a persistent
 * "being added" state rather than waiting on this promise.
 */
export async function apiCreateProject(
  client: SupabaseClient,
  input: { placeId: string },
): Promise<CreatedProject> {
  // `googlePlaceId` on the wire: `placeId` is reserved for place-row UUIDs
  // platform-wide (MESITA-51 addendum 9).
  return invokeEF<CreatedProject>(
    client,
    "consumer-web-create-project",
    { googlePlaceId: input.placeId },
    "Couldn't add that place right now.",
  );
}

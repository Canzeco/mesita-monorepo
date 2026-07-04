// Frontend API surface for the Search page — live catalog text search +
// the consumer "Add to Mesita" scheduling flow.
//
// Architectural constraints honoured (same as places.ts):
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper calls exactly one Edge Function.
//
// apiSuggestPlaces already lives in ./places (it backs the /explore/add
// picker); re-exported here so the Search surface has a single import
// site for both halves of its search→add pipeline.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export {
  apiSuggestPlaces,
  type PlacePrediction,
  type PlacePredictionStatus,
} from "./places";

export type ScheduledProjectCreation = {
  /** Row id in public.scheduled_project_creations. */
  scheduled_id: string;
  /** ISO timestamp the poller will fire the create at (defaults to now). */
  exec_at: string;
};

/**
 * Queue a Google-only search result for creation on Mesita.
 *
 * Calls consumer-schedule-project-creation, which inserts into the
 * scheduled_project_creations queue; the pg_cron poller then fires the
 * service-gated create pipeline and the n8n Enricher asynchronously.
 * The place lands with content_status='generating' and flips to 'ready'
 * once enriched — typically within ~5 minutes — so the UI should show a
 * persistent "being added" state rather than waiting on this promise.
 */
export async function apiScheduleProjectCreation(
  client: SupabaseClient,
  input: { placeId: string; exec_at?: string },
): Promise<ScheduledProjectCreation> {
  const body: Record<string, unknown> = { placeId: input.placeId };
  if (input.exec_at) body.exec_at = input.exec_at;
  return invokeEF<ScheduledProjectCreation>(
    client,
    "consumer-schedule-project-creation",
    body,
    "Couldn't queue that place right now.",
  );
}

"use server";

// Bulk create runs each Google Place ID through the SAME create pipeline as a
// single create — see the shared helper in @/lib/create-unit-from-place.
// admin-create-unit fetches Google data, persists places + units + photos,
// then triggers the n8n Enricher webhook (deep enrichment runs ASYNC). The
// client invokes this once per Place ID (with small concurrency) so progress
// streams in.
//
// For large batches the staggered queue (scheduled_project_creations rows
// drained by scheduler-run-project-creations) is the better fit once the
// scheduler is live; an admin enqueue EF would need building — the old
// admin-schedule-project-creations was removed in the 2026-07-03 audit.
// This path runs each create inline.

import { createUnitFromPlaceId as createUnitFromPlaceIdImpl } from "@/lib/create-unit-from-place";

export async function createUnitFromPlaceId(placeId: string) {
  return createUnitFromPlaceIdImpl(placeId);
}

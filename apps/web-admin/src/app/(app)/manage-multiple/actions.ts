"use server";

// Bulk create runs each Google Place ID through the SAME create pipeline as a
// single create — see the shared helper in @/lib/create-unit-from-place.
// admin-web-create-project fetches Google data and persists a minimal
// 'generating' place; deep enrichment then runs async in the Enricher cron
// pipeline (supabase-cron-enrich-place-*). Each create runs inline — the
// client invokes this once per Place ID (with small concurrency) so progress
// streams in.

import { createUnitFromPlaceId as createUnitFromPlaceIdImpl } from "@/lib/create-unit-from-place";

export async function createUnitFromPlaceId(placeId: string) {
  return createUnitFromPlaceIdImpl(placeId);
}

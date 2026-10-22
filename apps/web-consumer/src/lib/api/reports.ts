// A guest's report on a place (MESITA-2684): the three dots on the place
// screen open Report, and Send stores it through consumer-web-report-place,
// one per guest per place (a second report replaces the first).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

/** The reasons, in the sheet's order. The keys are the CHECK on
 *  place_reports.reason (supabase/.../_shared/place-reports.ts). */
export const PLACE_REPORT_REASONS = [
  { key: "closed", label: "Permanently closed" },
  { key: "wrong_info", label: "Wrong information" },
  { key: "wrong_location", label: "Wrong location" },
  { key: "inappropriate_photos", label: "Inappropriate photos" },
  { key: "duplicate", label: "Duplicate place" },
  { key: "other", label: "Something else" },
] as const;

export type PlaceReportReason = (typeof PLACE_REPORT_REASONS)[number]["key"];

export const PLACE_REPORT_NOTE_MAX = 500;

export async function apiReportPlace(
  client: SupabaseClient,
  input: { placeId: string; reason: PlaceReportReason; note?: string },
): Promise<void> {
  const note = input.note?.trim();
  await invokeEF<Record<string, never>>(client, "consumer-web-report-place", {
    place_id: input.placeId,
    reason: input.reason,
    ...(note ? { note } : {}),
  });
}

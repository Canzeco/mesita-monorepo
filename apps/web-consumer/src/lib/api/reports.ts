// A guest's report on a place (MESITA-2684): the three dots on the place
// screen open Report, and Send stores it through consumer-web-report-place.
// Reports are guest feedback, append-only (MESITA-3024): every send is its own
// row, and admin reads them all on Manage › Feedback.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

/** The reasons, in the sheet's order, with the note box's prompt for each.
 *  The keys are the CHECK on place_reports.reason
 *  (supabase/.../_shared/place-reports.ts, which pins this list). */
export const PLACE_REPORT_REASONS = [
  { key: "closed", label: "Permanently closed", prompt: "Anything to add? (optional)" },
  { key: "wrong_info", label: "Wrong information", prompt: "What's wrong? (optional)" },
  {
    key: "wrong_links",
    label: "Wrong or broken link",
    prompt: "Which link? Instagram, Facebook, website, menu…",
  },
  { key: "wrong_location", label: "Wrong location", prompt: "Anything to add? (optional)" },
  { key: "inappropriate_photos", label: "Inappropriate photos", prompt: "Anything to add? (optional)" },
  { key: "duplicate", label: "Duplicate place", prompt: "Anything to add? (optional)" },
  { key: "other", label: "Something else", prompt: "Tell us what's wrong" },
] as const;

export type PlaceReportReason = (typeof PLACE_REPORT_REASONS)[number]["key"];

/** Something else says nothing without words: the EF refuses it blank. */
export const NOTE_REQUIRED: ReadonlySet<PlaceReportReason> = new Set(["other"]);

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

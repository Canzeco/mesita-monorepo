// MESITA-2684: a guest's report on a place (the three dots, Report).
//
// The reasons are the CHECK on public.place_reports.reason; the consumer's
// sheet labels the same keys (apps/web-consumer/src/lib/api/reports.ts).
// The note is optional, trimmed, and at most 500 characters; an empty note
// is no note.

import { isMesitaPlaceId } from "./place-activity.ts";

export const PLACE_REPORT_REASONS = [
  "closed",
  "wrong_info",
  "wrong_location",
  "inappropriate_photos",
  "duplicate",
  "other",
] as const;
export type PlaceReportReason = typeof PLACE_REPORT_REASONS[number];

export const PLACE_REPORT_NOTE_MAX = 500;

export type PlaceReport = {
  placeId: string;
  reason: PlaceReportReason;
  note: string | null;
};

export function isPlaceReportReason(v: unknown): v is PlaceReportReason {
  return typeof v === "string" &&
    (PLACE_REPORT_REASONS as readonly string[]).includes(v);
}

/** Validates a report body. A Google-only card (`g:<id>`) is refused: it is
 *  not a place row yet. */
export function parsePlaceReport(
  body: Record<string, unknown>,
): { ok: true; report: PlaceReport } | { ok: false; error: string } {
  const placeId = body.place_id;
  if (!isMesitaPlaceId(placeId)) {
    return { ok: false, error: "place_id must be a Mesita place id" };
  }
  const reason = body.reason;
  if (!isPlaceReportReason(reason)) {
    return {
      ok: false,
      error: `reason must be one of ${PLACE_REPORT_REASONS.join(", ")}`,
    };
  }
  const raw = body.note;
  if (raw != null && typeof raw !== "string") {
    return { ok: false, error: "note must be a string" };
  }
  const note = typeof raw === "string" ? raw.trim() : "";
  if (note.length > PLACE_REPORT_NOTE_MAX) {
    return {
      ok: false,
      error: `note must be at most ${PLACE_REPORT_NOTE_MAX} characters`,
    };
  }
  return {
    ok: true,
    report: { placeId, reason, note: note === "" ? null : note },
  };
}

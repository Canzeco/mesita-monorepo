// MESITA-2684 / MESITA-3024: a guest's report on a place (the three dots,
// Report). Append-only: every send is its own row.
//
// The reasons are the CHECK on public.place_reports.reason; the consumer's
// sheet (apps/web-consumer/src/lib/api/reports.ts) and the admin console
// (apps/web-admin/src/lib/report-reasons.ts) label the same keys, and
// place-reports.test.ts fails when either list drifts. The note is trimmed
// and at most 500 characters; an empty note is no note, except for `other`,
// which needs one (a "Something else" with no words says nothing).

import { isMesitaPlaceId } from "./place-activity.ts";
import { isUuid } from "./place-id.ts";

export const PLACE_REPORT_REASONS = [
  "closed",
  "wrong_info",
  "wrong_links",
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
  if (reason === "other" && note === "") {
    return { ok: false, error: "note_required" };
  }
  return {
    ok: true,
    report: { placeId, reason, note: note === "" ? null : note },
  };
}

/** What admin-web-list-place-reports lists: one place (`{placeId}`, or the
 *  legacy `{projectId}`) or every report (`{all: true}`, Activity › Feedback).
 *  Presence is read off the raw keys, so `{placeId: 123, all: true}` is a
 *  400, never "everything". */
export type ReportListScope = { kind: "place"; placeId: string } | { kind: "all" };

export function parseReportListBody(
  body: Record<string, unknown>,
): { ok: true; scope: ReportListScope } | { ok: false; error: string } {
  const hasId = "placeId" in body || "projectId" in body;
  const hasAll = "all" in body;
  if (hasId && hasAll) {
    return { ok: false, error: "send placeId or all, not both" };
  }
  if (hasAll) {
    return body.all === true
      ? { ok: true, scope: { kind: "all" } }
      : { ok: false, error: "all must be true" };
  }
  if (hasId) {
    const raw = "placeId" in body ? body.placeId : body.projectId;
    const placeId = typeof raw === "string" ? raw.trim() : raw;
    return isUuid(placeId)
      ? { ok: true, scope: { kind: "place", placeId } }
      : { ok: false, error: "placeId must be a place id" };
  }
  return { ok: false, error: "placeId or all is required" };
}

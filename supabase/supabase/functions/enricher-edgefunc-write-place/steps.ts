// What the one write stamps (MESITA-2420). After the commit lands, each step
// the run bought is stamped from what was observed (crenup-report rule 2):
//
//   1 details      the Google spine committed
//   2 serp         the task's own report (Strong): the Scout's read never
//                  reaches the row, so only the task saw it
//   3 links        the task's own report (Strong): the write cannot tell
//                  "nothing found" from "the Resolver did not answer"
//   4 social       the Sync's Instagram and Facebook statuses
//   5 reviews      the Sync's Google reviews status
//   6 images       the gallery that landed
//   7 description  a persisted Presentation
//   8 embedding    the summary vector written
//
// Weak buys no Scout and no Links, so it stamps 1 and 4–8 and leaves 2 and 3
// as they were (rule 3: a step a run did not buy writes nothing). Absence is
// a result: no Instagram, no photos, nothing the Resolver kept all complete.

import { stepDone, stepFailed, type StampableCrenupStep, type StepOutcome } from "../_shared/crenup-report.ts";

export type TaskStepReport = { state: "completed" | "failed"; detail: string };

export type TaskSteps = Partial<Record<"serp" | "links", TaskStepReport>>;

const META = { via: "render" };

function report(raw: unknown): TaskStepReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as { state?: unknown; detail?: unknown };
  if (row.state !== "completed" && row.state !== "failed") return null;
  const detail = typeof row.detail === "string" ? row.detail.trim().slice(0, 300) : "";
  return { state: row.state, detail: detail || (row.state === "completed" ? "Done." : "Failed.") };
}

/** Only serp and links, and only a well-formed report. Anything else is dropped. */
export function readTaskSteps(raw: unknown): TaskSteps {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const body = raw as Record<string, unknown>;
  const out: TaskSteps = {};
  for (const key of ["serp", "links"] as const) {
    const row = report(body[key]);
    if (row) out[key] = row;
  }
  return out;
}

type SyncRow = { source?: unknown; status?: unknown; error?: unknown };

function syncRows(patch: Record<string, unknown>): SyncRow[] | null {
  const sync = patch.source_sync;
  if (!sync || typeof sync !== "object" || Array.isArray(sync)) return null;
  const sources = (sync as { sources?: unknown }).sources;
  return Array.isArray(sources) ? sources as SyncRow[] : null;
}

function syncError(rows: SyncRow[], source: string): string | null {
  const row = rows.find((item) => item?.source === source);
  if (!row || row.status !== "error") return null;
  return typeof row.error === "string" && row.error.trim() ? row.error.trim() : "did not respond";
}

function filled(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function asOutcome(row: TaskStepReport): StepOutcome {
  return row.state === "completed" ? stepDone(row.detail, META) : stepFailed(row.detail, META);
}

export function enrichStepOutcomes(input: {
  /** The profile that landed, photos resolved. */
  written: Record<string, unknown>;
  steps: TaskSteps;
  /** Photo links the run sent, and how many durable ones landed. */
  gallery: { sent: number; stored: number };
}): Partial<Record<StampableCrenupStep, StepOutcome>> {
  const written = input.written;
  const business = typeof written.business_state === "string" ? ` Google says ${written.business_state}.` : "";
  // A literal, not `out.details =`: dropped-column-refs reads an assignment
  // onto a local as a column write, and `details` is a retired column name.
  const out: Partial<Record<StampableCrenupStep, StepOutcome>> = {
    details: stepDone(`Google details persisted.${business}`, META),
  };

  if (input.steps.serp) out.serp = asOutcome(input.steps.serp);
  if (input.steps.links) out.links = asOutcome(input.steps.links);

  const rows = syncRows(written);
  if (rows) {
    const instagram = syncError(rows, "instagram");
    const facebook = syncError(rows, "facebook");
    out.social = instagram || facebook
      ? stepFailed(
        [instagram ? `Instagram: ${instagram}` : "", facebook ? `Facebook: ${facebook}` : ""]
          .filter(Boolean).join(" · "),
        META,
      )
      : stepDone("Instagram and Facebook synced for the links the profile has.", META);
    const reviews = syncError(rows, "google_reviews");
    const count = Array.isArray(written.google_reviews) ? written.google_reviews.length : 0;
    out.reviews = reviews
      ? stepFailed(`Google reviews: ${reviews}`, META)
      : stepDone(`${count} Google review(s) on the profile.`, META);
  }

  if (input.gallery.stored > 0) {
    out.images = stepDone(`${input.gallery.stored} photo(s) on the profile.`, META);
  } else if (input.gallery.sent > 0) {
    out.images = stepFailed("The photos were not copied into storage.", META);
  } else {
    out.images = stepDone("No photos to keep.", META);
  }

  out.description = filled(written.description)
    ? stepDone(
      `Presentation on the profile; category “${typeof written.category === "string" ? written.category : "n/a"}”, ` +
        `${Array.isArray(written.tags) ? written.tags.length : 0} tag(s).`,
      META,
    )
    : stepFailed("No Presentation was written.", META);

  out.embedding = filled(written.embedding)
    ? stepDone("Summary vector written.", META)
    : stepFailed("The summary vector did not write. Re-enrich to retry.", META);

  return out;
}

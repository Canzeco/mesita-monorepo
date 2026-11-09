"use server";

import type { ActionResult } from "@/lib/action-result";
import type { AdminAppFeedback, AdminPlaceReport } from "@/components/reports/types";
import { efInvoke } from "@/lib/supabase-ef";

export type ListFeedbackResult = ActionResult<{
  reports: AdminPlaceReport[];
  capped: boolean;
}>;

export type ListAppFeedbackResult = ActionResult<{
  feedback: AdminAppFeedback[];
  capped: boolean;
}>;

/** Every guest report across places, newest first (admin-web-list-place-
 *  reports with `all`, MESITA-3024). Read-only. */
export async function listFeedback(): Promise<ListFeedbackResult> {
  const r = await efInvoke<{ reports?: AdminPlaceReport[]; capped?: boolean }>(
    "admin-web-list-place-reports",
    { all: true },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, reports: r.data.reports ?? [], capped: r.data.capped === true };
}

/** Every guest's feedback about the app itself, newest first
 *  (admin-web-list-app-feedback, MESITA-3029). Read-only. */
export async function listAppFeedback(): Promise<ListAppFeedbackResult> {
  const r = await efInvoke<{ feedback?: AdminAppFeedback[]; capped?: boolean }>(
    "admin-web-list-app-feedback",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, feedback: r.data.feedback ?? [], capped: r.data.capped === true };
}

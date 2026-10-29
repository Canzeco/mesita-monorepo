"use server";

import type { ActionResult } from "@/lib/action-result";
import type { AdminPlaceReport } from "@/components/place-manage/actions";
import { efInvoke } from "@/lib/supabase-ef";

export type ListFeedbackResult = ActionResult<{
  reports: AdminPlaceReport[];
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

"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import type { ActivitySummary } from "@/lib/activity-summary-types";

export async function getActivitySummary(): Promise<ActionResult<ActivitySummary>> {
  const r = await efInvoke<ActivitySummary>("admin-web-get-activity-summary", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, ...r.data };
}

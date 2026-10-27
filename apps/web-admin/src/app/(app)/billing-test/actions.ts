"use server";

// Server action for the Billing Test page. Thin wrapper over
// admin-web-check-api-health via the Result-style efInvoke (never throws) —
// same contract as the config-page actions.
//
// The vendor API keys live in Supabase Edge Function secrets and nowhere else,
// so the probe HAS to run inside an EF: web-admin's own environment holds only
// the three public NEXT_PUBLIC_SUPABASE_* vars. Running the probes from a
// Next.js server action instead would mean copying seven secrets into Vercel.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { type ApifyUsage, type ApifyWindow, coerceApifyUsage } from "./apify-usage";
import { coerceResults, type ProbeResult } from "./catalog";

/** Apify spend and run health per scraper. Read-only: runs no actor. */
export async function getApifyUsage(
  days: ApifyWindow,
): Promise<ActionResult<{ usage: ApifyUsage }>> {
  const r = await efInvoke<unknown>("admin-web-get-apify-usage", { days });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, usage: coerceApifyUsage(r.data) };
}

type RunProbesResult =
  | { ok: true; checkedAt: string; results: ProbeResult[] }
  | { ok: false; error: string };

/**
 * Run health probes.
 *
 * @param providers Explicit provider ids. The page always names them — one
 *   card's id, or every id behind the single Run button.
 */
export async function runApiHealthProbes(
  providers: string[],
): Promise<RunProbesResult> {
  const r = await efInvoke<{ checkedAt?: string; results?: unknown }>(
    "admin-web-check-api-health",
    { providers },
  );

  if (!r.ok) return { ok: false, error: r.error };

  return {
    ok: true,
    checkedAt: typeof r.data.checkedAt === "string"
      ? r.data.checkedAt
      : new Date().toISOString(),
    results: coerceResults(r.data.results),
  };
}

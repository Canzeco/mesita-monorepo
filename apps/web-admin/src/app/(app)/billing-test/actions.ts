"use server";

// Server action for the Billing Test page. Thin wrapper over
// admin-web-check-api-health via the Result-style efInvoke (never throws) —
// same contract as the config-page actions.
//
// The vendor API keys live in Supabase Edge Function secrets and nowhere else,
// so the probe HAS to run inside an EF: web-admin's own environment holds only
// the three public NEXT_PUBLIC_SUPABASE_* vars. Running the probes from a
// Next.js server action instead would mean copying seven secrets into Vercel.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceResults, type ProbeResult } from "./catalog";

type RunProbesResult =
  | { ok: true; checkedAt: string; results: ProbeResult[] }
  | { ok: false; error: string; notDeployed: boolean };

/**
 * Run health probes.
 *
 * @param providers Explicit provider ids. The page always names them — one
 *   card's id, or every id behind the single Run button — so the sweep is
 *   identical whether or not the EF has shipped its own "no list = all"
 *   default yet.
 */
export async function runApiHealthProbes(
  providers: string[],
): Promise<RunProbesResult> {
  const r = await efInvoke<{ checkedAt?: string; results?: unknown }>(
    "admin-web-check-api-health",
    { providers },
  );

  if (!r.ok) {
    // 404 means the function isn't in the project yet — a materially different
    // situation from a probe failing, and the page says so explicitly rather
    // than showing a generic error the operator would have to decode.
    return { ok: false, error: r.error, notDeployed: r.status === 404 };
  }

  return {
    ok: true,
    checkedAt: typeof r.data.checkedAt === "string"
      ? r.data.checkedAt
      : new Date().toISOString(),
    results: coerceResults(r.data.results),
  };
}

// Render talks to one Edge Function. It does not open the database.

import type { PhotoAnalysis } from "./images.ts";
import type { RanSteps } from "./steps.ts";
import { type CostLedger, PRICES_READ_ON } from "./cost.ts";

/** What the run spent, per step (MESITA-2806). The write stores it as one
 *  place_enrichment_runs row; an estimate, never a cap. */
export type RunCost = {
  startedAt: string;
  pricesReadOn: string;
  usd: number;
  steps: { step: string; vendor: string; usd: number; calls: number }[];
};

export function runCost(ledger: CostLedger, startedAt: string): RunCost {
  return { startedAt, pricesReadOn: PRICES_READ_ON, usd: ledger.totalUsd(), steps: ledger.byStep() };
}

const WRITE_FUNCTION = "enricher-edgefunc-write-place";

export function writePlaceUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${WRITE_FUNCTION}`;
}

/** The one commit body. Steps and the Scout's read ride beside the profile:
 *  the write stamps the steps, and the read grounds the Presentation. */
export function commitBody(
  placeId: string,
  built: {
    patch: Record<string, unknown>;
    mirrorPhotos: boolean;
    photoAnalyses: PhotoAnalysis[];
    steps: RanSteps;
    serpSummary: string | null;
  },
  baseUpdatedAt?: string | null,
  cost?: RunCost,
): Record<string, unknown> {
  return {
    placeId,
    patch: built.patch,
    mirrorPhotos: built.mirrorPhotos,
    ...(baseUpdatedAt ? { baseUpdatedAt } : {}),
    ...(built.photoAnalyses.length > 0 ? { photoAnalyses: built.photoAnalyses } : {}),
    ...(Object.keys(built.steps).length > 0 ? { steps: built.steps } : {}),
    ...(built.serpSummary ? { serpSummary: built.serpSummary } : {}),
    ...(cost ? { cost } : {}),
  };
}

export async function writeFinishedPlace(
  placeId: string,
  built: Parameters<typeof commitBody>[1],
  baseUpdatedAt?: string | null,
  cost?: RunCost,
): Promise<{ placeId: string }> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const writeKey = process.env.ENRICH_WRITE_KEY?.trim() ?? "";
  if (!supabaseUrl || !writeKey) {
    throw new Error("Render is missing SUPABASE_URL or ENRICH_WRITE_KEY");
  }
  const res = await fetch(writePlaceUrl(supabaseUrl), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${writeKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commitBody(placeId, built, baseUpdatedAt, cost)),
  });
  const body = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `write place failed (${res.status})`);
  }
  return { placeId };
}

// Sent before a failed task exits. The function turns enriching off. A
// failure here must not replace the error that failed the run. `closed` is
// the liveness halt: the function also records Google's CLOSED_PERMANENTLY and
// stamps Details failed with that reason.
// A stop carries the run's cost when the task had one: a failed run still paid.
export function stopEnrichingBody(
  placeId: string,
  opts: { closed?: boolean; cost?: RunCost } = {},
): { placeId: string; stop: true; closed?: true; cost?: RunCost } {
  return {
    placeId,
    stop: true,
    ...(opts.closed ? { closed: true as const } : {}),
    ...(opts.cost ? { cost: opts.cost } : {}),
  };
}

export async function stopEnriching(
  placeId: string,
  opts: { closed?: boolean; cost?: RunCost } = {},
): Promise<void> {
  const id = placeId.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const writeKey = process.env.ENRICH_WRITE_KEY?.trim() ?? "";
  if (!id) return;
  if (!supabaseUrl || !writeKey) {
    // The place stays enriching until the hourly sweep (MESITA-2804) puts it back.
    const missing = [!supabaseUrl && "SUPABASE_URL", !writeKey && "ENRICH_WRITE_KEY"].filter(Boolean).join(", ");
    console.error(`[enrich] stop enriching skipped for ${id}: missing ${missing}`);
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(writePlaceUrl(supabaseUrl), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${writeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stopEnrichingBody(id, opts)),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      console.error(`[enrich] stop enriching failed: ${body?.error || res.status}`);
    }
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] stop enriching failed: ${why}`);
  } finally {
    clearTimeout(timer);
  }
}

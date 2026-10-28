// What a Render run spent, stored as one closed place_enrichment_runs row
// (MESITA-2806). Render estimates each step's vendor cost (render/src/cost.ts)
// and sends it with the commit or the stop; a body without `cost` (an older
// task, or a wave stopping a place it never started) records nothing.
// Recording only: nothing reads cost_usd to cap a run. A failed insert is
// logged and never fails the write.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type RunCostStep = { step: string; vendor: string; usd: number; calls: number };
export type RunCost = { startedAt: string; pricesReadOn: string | null; usd: number; steps: RunCostStep[] };
export type RunOutcome = "succeeded" | "failed" | "abandoned";

// numeric(8,4) holds at most 9999.9999.
const MAX_USD = 9999.9999;

export function readRunCost(body: unknown): RunCost | null {
  const raw = (body as { cost?: unknown } | null)?.cost;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const cost = raw as { startedAt?: unknown; pricesReadOn?: unknown; usd?: unknown; steps?: unknown };
  const usd = usdOf(cost.usd);
  if (usd === null) return null;
  const startedAt = typeof cost.startedAt === "string" && !Number.isNaN(Date.parse(cost.startedAt))
    ? cost.startedAt
    : new Date().toISOString();
  const steps = (Array.isArray(cost.steps) ? cost.steps : []).slice(0, 50).flatMap((row) => {
    const r = row as Partial<Record<keyof RunCostStep, unknown>> | null;
    const stepUsd = usdOf(r?.usd);
    if (!r || typeof r.step !== "string" || typeof r.vendor !== "string" || stepUsd === null) return [];
    const calls = typeof r.calls === "number" && Number.isFinite(r.calls) ? Math.max(0, Math.floor(r.calls)) : 0;
    return [{ step: r.step.slice(0, 40), vendor: r.vendor.slice(0, 40), usd: stepUsd, calls }];
  });
  const pricesReadOn = typeof cost.pricesReadOn === "string" ? cost.pricesReadOn.slice(0, 20) : null;
  return { startedAt, pricesReadOn, usd, steps };
}

export function runCostRow(placeId: string, cost: RunCost, outcome: RunOutcome, endReason: string | null) {
  return {
    place_id: placeId,
    // The runs table predates Render; its trigger vocabulary has no Render
    // value, and the job does not say what queued it. 'manual' is the one
    // trigger every cooldown ignores.
    trigger_key: "manual",
    seeded_by: "render",
    entry_stage: "first",
    started_at: cost.startedAt,
    ended_at: new Date().toISOString(),
    outcome,
    end_reason: endReason,
    stage_reached: outcome === "succeeded" ? "done" : "failed",
    cost_usd: cost.usd,
    cost_charges: cost.steps,
    meta: { source: "render", estimated: true, prices_read_on: cost.pricesReadOn },
  };
}

export async function recordRunCost(
  admin: SupabaseClient,
  placeId: string,
  cost: RunCost | null,
  outcome: RunOutcome,
  endReason: string | null = null,
): Promise<void> {
  if (!cost) return;
  const { error } = await admin.from("place_enrichment_runs").insert(runCostRow(placeId, cost, outcome, endReason));
  if (error) console.error(`[enrich] ${placeId}: run cost not stored: ${error.message}`);
  else console.log(`[enrich] ${placeId}: run cost $${cost.usd.toFixed(4)} (${outcome})`);
}

function usdOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(MAX_USD, Math.round(value * 10000) / 10000);
}

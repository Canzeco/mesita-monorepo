// Step 2, the Scout: one Perplexity Agent call for a short web-grounded read
// of the place, run before Links. Soft context only: the Resolver reads it to
// tell which candidate is really this place, and the write's Presentation
// reads it in the SERP slot. It never reaches the place row.
//
// The instructions and the per-place message ride on the job, built by the
// Edge Function from the same constant and builder admin Enrichment renders
// (supabase/.../_shared/enrich-serp.ts), so the console shows what Perplexity
// receives. The schema below is that file's SERP_SCHEMA.

import { callAgent } from "./perplexity.ts";
import { completed, failed, type StepReport } from "./steps.ts";

const SERP_SCHEMA = {
  type: "object",
  properties: { summary: { type: ["string", "null"] } },
};

/** The prompt asks for at most 120 words; the agent can drift. */
export const SCOUT_WORD_CAP = 130;

export function capSummary(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || text.toLowerCase() === "null") return null;
  return text.split(/\s+/).slice(0, SCOUT_WORD_CAP).join(" ");
}

export async function scoutPlace(opts: {
  input: string;
  instructions?: string;
  preset?: string;
  perplexityKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ summary: string | null; report: StepReport }> {
  const key = opts.perplexityKey?.trim() ?? "";
  const instructions = opts.instructions?.trim() ?? "";
  if (!key) return { summary: null, report: failed("Render is missing PERPLEXITY_KEY, so the Scout did not run.") };
  if (!instructions) return { summary: null, report: failed("The job carried no Scout instructions.") };
  const res = await callAgent({
    apiKey: key,
    input: opts.input,
    instructions,
    preset: opts.preset?.trim() || "pro-search",
    maxSteps: 6,
    schema: SERP_SCHEMA,
    tag: "scout",
    fetchImpl: opts.fetchImpl,
  });
  if (!res) return { summary: null, report: failed("The Scout did not answer.") };
  const summary = capSummary(res.answer.summary);
  if (!summary) return { summary: null, report: completed("The Scout found nothing reliable on the web.") };
  const words = summary.split(/\s+/).length;
  return { summary, report: completed(`The Scout wrote ${words} words of web context.`) };
}

// Shared Perplexity Agent (pro-search) client. One fetch/parse contract for
// every Atlas Perplexity call: the Scout's SERP summary (enrich-serp.ts) and the
// Resolver's channel selection (enrich-channel-discovery.ts). Each caller passes
// its own instructions. Best-effort: any non-2xx / network / parse failure
// returns null, so callers degrade to null.

import { safeParseJson } from "./parse-utils.ts";

const PERPLEXITY_AGENT_URL = "https://api.perplexity.ai/v1/agent";
// Default preset when the caller doesn't pass one (matches the app_config
// default). Callers pass the admin-selected preset via opts.preset.
const DEFAULT_PRESET = "pro-search";
// A slow agent used to stall the whole research stage. Past this, the call
// aborts and the caller degrades (MESITA-2198).
export const PERPLEXITY_AGENT_TIMEOUT_MS = 45_000;

// Call the managed Perplexity Agent once. Returns the schema JSON answer plus the
// source URLs the agent actually cited (annotations) — both host-locked, so
// callers must re-validate every URL before trusting it. null on any failure.
export async function callPerplexityAgent(
  key: string,
  input: string,
  schema: unknown,
  opts: { instructions: string; maxSteps?: number; preset?: string },
): Promise<{ answer: Record<string, unknown>; hitUrls: string[] } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PERPLEXITY_AGENT_TIMEOUT_MS);
  try {
    const r = await fetch(PERPLEXITY_AGENT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        input,
        preset: opts.preset ?? DEFAULT_PRESET,
        instructions: opts.instructions,
        max_steps: opts.maxSteps ?? 8,
        response_format: { type: "json_schema", json_schema: { schema } },
      }),
    });
    if (!r.ok) {
      const body = (await r.text().catch(() => "")).slice(0, 200);
      console.error(`[perplexity-agent] ${r.status} ${body}`);
      return null;
    }
    const d = (await r.json()) as {
      output?: {
        type?: string;
        content?: { text?: string; annotations?: { url?: unknown }[] }[];
      }[];
    };
    let text = "";
    const hitUrls: string[] = [];
    for (const it of d.output ?? []) {
      if (it?.type === "message" && Array.isArray(it.content)) {
        for (const c of it.content) {
          if (typeof c?.text === "string") text += c.text;
          for (const a of c?.annotations ?? []) {
            if (a && typeof a.url === "string") hitUrls.push(a.url);
          }
        }
      }
    }
    const answer = (safeParseJson(text) as Record<string, unknown> | null) ?? {};
    return { answer, hitUrls };
  } catch (err) {
    const why = ctrl.signal.aborted
      ? `timeout after ${PERPLEXITY_AGENT_TIMEOUT_MS}ms`
      : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[perplexity-agent] ${why}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

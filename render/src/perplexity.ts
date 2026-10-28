// The one Perplexity Agent client the task uses: the Scout (step 2) and the
// Resolver (step 3) each pass their own instructions, message and schema.
// Any non-2xx, timeout or network failure is null, so a caller can tell "the
// agent did not answer" from "the agent answered null".

import { charge, perplexityUsd } from "./cost.ts";

const AGENT_URL = "https://api.perplexity.ai/v1/agent";
export const AGENT_TIMEOUT_MS = 45_000;

type FetchImpl = typeof fetch;

export type AgentAnswer = { answer: Record<string, unknown>; hitUrls: string[] };

export async function callAgent(opts: {
  apiKey: string;
  input: string;
  instructions: string;
  preset: string;
  maxSteps: number;
  schema: Record<string, unknown>;
  tag: string;
  fetchImpl?: FetchImpl;
}): Promise<AgentAnswer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  try {
    const res = await (opts.fetchImpl ?? fetch)(AGENT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: opts.input,
        preset: opts.preset,
        instructions: opts.instructions,
        max_steps: opts.maxSteps,
        response_format: { type: "json_schema", json_schema: { schema: opts.schema } },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`[${opts.tag}] perplexity ${res.status} ${body}`);
      return null;
    }
    const payload = await res.json();
    const cost = perplexityUsd(payload);
    charge("perplexity", cost.usd, `${opts.tag} ${opts.preset}${cost.reported ? "" : " (estimated)"}`);
    return agentResult(payload);
  } catch (err) {
    const why = ctrl.signal.aborted
      ? `timeout after ${AGENT_TIMEOUT_MS}ms`
      : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[${opts.tag}] perplexity ${why}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function agentResult(payload: unknown): AgentAnswer {
  const output = payload && typeof payload === "object"
    ? (payload as { output?: { type?: string; content?: { text?: string; annotations?: { url?: unknown }[] }[] }[] }).output
    : undefined;
  let text = "";
  const hitUrls: string[] = [];
  for (const item of output ?? []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (typeof part?.text === "string") text += part.text;
      for (const note of part?.annotations ?? []) {
        if (note && typeof note.url === "string") hitUrls.push(note.url);
      }
    }
  }
  return { answer: parseJsonObject(text) ?? {}, hitUrls };
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const tryParse = (value: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  };
  return tryParse(trimmed) ?? (() => {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return tryParse(trimmed.slice(start, end + 1));
  })();
}

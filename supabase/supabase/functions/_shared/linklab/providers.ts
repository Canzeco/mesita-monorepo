// linklab — provider wrappers (Firecrawl v2, Perplexity Search/Agent/Sonar, Google Places,
// Claude with server-side web search/fetch).
// Best-effort: every call returns a safe empty value on failure so a strategy degrades
// instead of throwing. Optional on-disk response cache (keyed by request) is enabled ONLY
// when Deno.env LINKLAB_CACHE_DIR is set — the local benchmark runner sets it so that
// iterating on strategy logic doesn't re-bill Firecrawl/Perplexity/Google. Unset, every
// call hits the live APIs.

import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { safeParseJson } from "../parse-utils.ts";

export type Keys = {
  firecrawl: string;
  perplexity: string;
  google: string;
  /** MESITA-2118: only strategy G needs it; "" when unset. */
  anthropic: string;
};

export type SearchHit = { url: string; title: string; snippet: string };

// ---- call + cost accounting (read by the runner after a batch) --------------
export const meter = {
  firecrawlSearch: 0,
  firecrawlScrape: 0,
  perplexitySearch: 0,
  perplexityAgent: 0,
  perplexitySonar: 0,
  googleText: 0,
  claudeCalls: 0,
  claudeSearches: 0,
  claudeFetches: 0,
  claudeInputTokens: 0,
  claudeOutputTokens: 0,
  cacheHits: 0,
  reset() {
    const self = this as Record<string, unknown>;
    for (const k of Object.keys(self)) {
      if (typeof self[k] === "number") self[k] = 0;
    }
  },
};

// ---- cache ------------------------------------------------------------------
// Read lazily each call so import order can't strand the setting; unset, this stays
// null and every call hits the live API.
function cacheDir(): string | null {
  try {
    return Deno.env.get("LINKLAB_CACHE_DIR") ?? null;
  } catch {
    return null;
  }
}

async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

async function cached<T>(tag: string, req: unknown, run: () => Promise<T>): Promise<T> {
  const dir = cacheDir();
  if (!dir) return run();
  const key = `${tag}-${await sha(JSON.stringify(req))}`;
  const path = `${dir}/${key}.json`;
  try {
    const hit = await Deno.readTextFile(path);
    meter.cacheHits++;
    return JSON.parse(hit) as T;
  } catch {
    /* miss */
  }
  const out = await run();
  try {
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(path, JSON.stringify(out));
  } catch {
    /* ignore cache write errors */
  }
  return out;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 45000,
): Promise<unknown | null> {
  // one retry on 429 / 5xx
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { ...init, signal: ctrl.signal });
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
        continue;
      }
      return null;
    } catch {
      // network/abort — retry once
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// ---- Firecrawl v2 -----------------------------------------------------------
export function firecrawlSearch(
  keys: Keys,
  query: string,
  limit = 8,
  location?: string,
): Promise<SearchHit[]> {
  return cached("fc-search", { query, limit, location }, async () => {
    meter.firecrawlSearch++;
    const body: Record<string, unknown> = { query, limit, sources: [{ type: "web" }] };
    if (location) body.location = location;
    const d = (await fetchJson("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.firecrawl}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })) as { data?: { web?: unknown[] } | unknown[] } | null;
    if (!d) return [];
    const web = Array.isArray(d.data) ? d.data : (d.data?.web ?? []);
    return (web as Record<string, unknown>[])
      .filter((x) => typeof x?.url === "string")
      .map((x) => ({
        url: x.url as string,
        title: (x.title as string) ?? "",
        snippet: (x.description as string) ?? "",
      }));
  });
}

export function firecrawlScrapeLinks(
  keys: Keys,
  url: string,
): Promise<{ markdown: string; links: string[] } | null> {
  return cached("fc-scrape", { url }, async () => {
    meter.firecrawlScrape++;
    const d = (await fetchJson(
      "https://api.firecrawl.dev/v2/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${keys.firecrawl}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          formats: ["markdown", "links"],
          onlyMainContent: false, // footer is where social links live
        }),
      },
      30000,
    )) as { data?: { markdown?: string; links?: string[] } } | null;
    if (!d?.data) return null;
    return {
      markdown: d.data.markdown ?? "",
      links: Array.isArray(d.data.links) ? d.data.links : [],
    };
  });
}

// ---- Perplexity Search API (/search) — pure retrieval -----------------------
export function perplexitySearch(
  keys: Keys,
  query: string,
  maxResults = 10,
  country = "MX",
): Promise<SearchHit[]> {
  return cached("ppx-search", { query, maxResults, country }, async () => {
    meter.perplexitySearch++;
    const d = (await fetchJson("https://api.perplexity.ai/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.perplexity}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: maxResults, country }),
    })) as { results?: Record<string, unknown>[] } | null;
    if (!d?.results) return [];
    return d.results
      .filter((x) => typeof x?.url === "string")
      .map((x) => ({
        url: x.url as string,
        title: (x.title as string) ?? "",
        snippet: (x.snippet as string) ?? "",
      }));
  });
}

// ---- Perplexity Agent (/v1/agent, pro-search) — same contract as prod -------
const AGENT_DEFAULT_INSTRUCTIONS =
  "Resolve place URLs by anchoring on the official website and trusting the links the site itself points to. Output only JSON matching the schema. Never fabricate URLs; prefer null when unsure.";

export function perplexityAgent(
  keys: Keys,
  input: string,
  schema: unknown,
  opts: { instructions?: string; maxSteps?: number } = {},
): Promise<{ answer: Record<string, unknown>; hitUrls: string[] }> {
  return cached("ppx-agent", { input, schema, opts }, async () => {
    meter.perplexityAgent++;
    const d = (await fetchJson(
      "https://api.perplexity.ai/v1/agent",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${keys.perplexity}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          preset: "pro-search",
          instructions: opts.instructions ?? AGENT_DEFAULT_INSTRUCTIONS,
          max_steps: opts.maxSteps ?? 8,
          response_format: { type: "json_schema", json_schema: { schema } },
        }),
      },
      90000,
    )) as {
      output?: { type?: string; content?: { text?: string; annotations?: { url?: unknown }[] }[] }[];
    } | null;
    const hitUrls: string[] = [];
    let text = "";
    for (const it of d?.output ?? []) {
      if (it?.type === "message" && Array.isArray(it.content)) {
        for (const c of it.content) {
          if (typeof c?.text === "string") text += c.text;
          for (const a of c?.annotations ?? []) {
            if (a && typeof a.url === "string") hitUrls.push(a.url);
          }
        }
      }
    }
    return { answer: safeJson(text), hitUrls };
  });
}

// ---- Perplexity Sonar (/v1/chat/completions) — structured judge -------------
export function perplexitySonar(
  keys: Keys,
  system: string,
  user: string,
  schema: unknown,
  opts: {
    model?: string;
    searchContextSize?: "low" | "medium" | "high";
    /** MESITA-192: pure-judge variant — no Firecrawl recall; Sonar answers blind. */
    disableSearch?: boolean;
  } = {},
): Promise<{ answer: Record<string, unknown>; searchResults: SearchHit[] }> {
  return cached("ppx-sonar", { system, user, schema, opts }, async () => {
    meter.perplexitySonar++;
    const body: Record<string, unknown> = {
      model: opts.model ?? "sonar-pro",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { schema },
      },
    };
    // disable_search pure-judge (strategy F): measure whether dropping Firecrawl
    // recall and letting sonar-pro answer blind changes precision/recall/cost.
    if (opts.disableSearch) {
      body.disable_search = true;
    } else {
      body.web_search_options = {
        search_context_size: opts.searchContextSize ?? "medium",
      };
    }
    const d = (await fetchJson(
      "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${keys.perplexity}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      60000,
    )) as {
      choices?: { message?: { content?: string } }[];
      search_results?: Record<string, unknown>[];
    } | null;
    const content = d?.choices?.[0]?.message?.content ?? "";
    const searchResults = (d?.search_results ?? [])
      .filter((x) => typeof x?.url === "string")
      .map((x) => ({
        url: x.url as string,
        title: (x.title as string) ?? "",
        snippet: (x.snippet as string) ?? "",
      }));
    return { answer: safeJson(content), searchResults };
  });
}

// ---- Claude (Messages API + server-side web_search / web_fetch) -------------
// MESITA-2118. Claude runs its own searches and reads pages itself (both tools execute
// on Anthropic's side), then answers through the strict `submit_links` tool. The only
// client-side loop is resuming `pause_turn` — the server's 10-iteration sampling cap.
export const CLAUDE_MODEL = "claude-opus-5-5";
const CLAUDE_MAX_CONTINUATIONS = 4;
const SUBMIT_TOOL = "submit_links";

type ClaudeCreate = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Beta.Messages.BetaMessage>;

export type ClaudeResearchOpts = {
  effort?: "low" | "medium" | "high";
  maxSearches?: number;
  maxFetches?: number;
};

export type ClaudeResearch = {
  answer: Record<string, unknown>;
  searches: number;
  fetches: number;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
  error?: string;
};

export function claudeResearch(
  keys: Keys,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: ClaudeResearchOpts = {},
): Promise<ClaudeResearch> {
  return cached("claude", { model: CLAUDE_MODEL, system, user, schema, opts }, async () => {
    if (!keys.anthropic) return { ...emptyResearch(), error: "no ANTHROPIC_API_KEY" };
    meter.claudeCalls++;
    const client = new Anthropic({ apiKey: keys.anthropic, timeout: 180_000 });
    const out = await runClaudeResearch(
      (p) => client.beta.messages.create(p),
      system,
      user,
      schema,
      opts,
    );
    meter.claudeSearches += out.searches;
    meter.claudeFetches += out.fetches;
    meter.claudeInputTokens += out.inputTokens;
    meter.claudeOutputTokens += out.outputTokens;
    return out;
  });
}

/** The request loop, with `create` injected so tests can replay canned responses. */
export async function runClaudeResearch(
  create: ClaudeCreate,
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: ClaudeResearchOpts = {},
): Promise<ClaudeResearch> {
  const out = emptyResearch();
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: user }];
  for (let turn = 0; turn <= CLAUDE_MAX_CONTINUATIONS; turn++) {
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      res = await create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system,
        output_config: { effort: opts.effort ?? "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: opts.maxSearches ?? 6,
            user_location: { type: "approximate", country: "MX" },
          },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: opts.maxFetches ?? 6 },
          {
            name: SUBMIT_TOOL,
            description:
              "Submit the final answer: the place's official website URL and Instagram profile URL, null for any you could not verify. Call exactly once, at the end.",
            strict: true,
            input_schema: { ...schema, type: "object", additionalProperties: false },
          },
        ],
        messages,
      });
    } catch (e) {
      return { ...out, error: String(e) };
    }
    const u = res.usage;
    out.searches += u.server_tool_use?.web_search_requests ?? 0;
    out.fetches += u.server_tool_use?.web_fetch_requests ?? 0;
    out.inputTokens += u.input_tokens + (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0);
    out.outputTokens += u.output_tokens;
    out.stopReason = res.stop_reason;

    for (const b of res.content) {
      if (b.type === "tool_use" && b.name === SUBMIT_TOOL && b.input && typeof b.input === "object") {
        return { ...out, answer: b.input as Record<string, unknown> };
      }
    }
    if (res.stop_reason !== "pause_turn") {
      // Answered in prose instead of the tool — tolerate a JSON object in the text.
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return { ...out, answer: safeJson(text) };
    }
    // pause_turn: resend with the paused assistant turn; the server resumes on its own.
    messages.push({ role: "assistant", content: res.content });
  }
  return { ...out, error: "pause_turn continuations exhausted" };
}

function emptyResearch(): ClaudeResearch {
  return { answer: {}, searches: 0, fetches: 0, inputTokens: 0, outputTokens: 0, stopReason: null };
}

// ---- Google Places v1 -------------------------------------------------------
export type GooglePlace = {
  placeId: string;
  name: string;
  websiteUri: string | null;
  types: string[];
  formattedAddress: string | null;
  editorialSummary: string | null;
  googleMapsUri: string | null;
};

export function googleResolvePlace(
  keys: Keys,
  name: string,
  city: string,
): Promise<GooglePlace | null> {
  return cached("g-text", { name, city }, async () => {
    meter.googleText++;
    const d = (await fetchJson("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": keys.google,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.websiteUri,places.types,places.formattedAddress,places.editorialSummary,places.googleMapsUri",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textQuery: `${name} ${city}`, languageCode: "es", regionCode: "MX" }),
    })) as { places?: Record<string, unknown>[] } | null;
    const p = d?.places?.[0];
    if (!p || typeof p.id !== "string") return null;
    return mapGooglePlace(p);
  });
}

function mapGooglePlace(p: Record<string, unknown>): GooglePlace {
  const disp = p.displayName as { text?: string } | undefined;
  const edit = p.editorialSummary as { text?: string } | undefined;
  return {
    placeId: p.id as string,
    name: disp?.text ?? "",
    websiteUri: (p.websiteUri as string) ?? null,
    types: Array.isArray(p.types) ? (p.types as string[]) : [],
    formattedAddress: (p.formattedAddress as string) ?? null,
    editorialSummary: edit?.text ?? null,
    googleMapsUri: (p.googleMapsUri as string) ?? null,
  };
}

// ---- util -------------------------------------------------------------------
// Shared with prod Enricher parse-utils (MESITA-192): tolerate fences, prose,
// trailing commas, and truncated closing braces under concurrent Sonar load.
function safeJson(text: string): Record<string, unknown> {
  const parsed = safeParseJson(text);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

// memo-airlock.ts — the security airlock for Memo's read-only reasoning agent.
//
// Memo v-next reasons with OpenAI, but the model is untrusted: the user's
// message (and every web page / DB row a tool returns) can carry injected
// instructions. The airlock is the sealed chamber around that model.
//
//   • The model can ONLY call the tools registered here. It cannot invent a
//     tool, write SQL, or name a table — it emits a tool NAME + JSON args and
//     the airlock decides what actually runs.
//   • Every tool is READ-ONLY. There is no write / reserve / edit / delete
//     tool in the registry, so Memo is passive BY CONSTRUCTION, not by policy
//     or prompt — the capability simply does not exist to be jailbroken into.
//   • Args are validated against the tool's declared schema before the handler
//     runs (unknown keys dropped, types coerced, values clamped). A tool that
//     needs the caller's identity reads it from the sealed context — never
//     from a model-supplied parameter — so "user X's Instagram" has no path.
//   • Results are the tool's own responsibility to shape to public-safe fields
//     before they re-enter the model context.
//
// This file is the mechanism (registry + validated dispatch + the OpenAI
// tool-calling loop). The concrete tools live in ./memo-airlock-tools.ts.
//
// An OPTIONAL trace sink (ctx.trace) records the model's rounds and every tool
// dispatch for the admin playground. It is absent on the consumer path — the
// live concierge is unchanged and pays no overhead.

import type { MemoData } from "./memo-data.ts";
import type { Prediction } from "./memo-types.ts";
import { clampSummary, type TraceSink, toolSource } from "./memo-trace.ts";

// ── Tool contract ──────────────────────────────────────────────────────

// A minimal JSON-schema subset — enough to describe read tool params AND to
// validate them without a schema library. Every property is one of these.
export type ParamSpec =
  | { type: "string"; description?: string; enum?: string[]; maxLen?: number }
  | { type: "boolean"; description?: string }
  | {
    type: "number";
    description?: string;
    min?: number;
    max?: number;
    integer?: boolean;
  };

export type ToolSchema = {
  properties: Record<string, ParamSpec>;
  required?: string[];
};

// The sealed context. Handed to every tool; NEVER exposed to the model.
//
// `data` is Memo's data client (memo-data.ts), NOT a Supabase client: it speaks
// to four named read-only Edge Functions and nothing else. So the airlock's two
// halves now match — the model can only call a whitelisted tool, and a tool can
// only call a whitelisted endpoint. There is no generic query capability
// anywhere inside the chamber to be jailbroken into.
export type AirlockContext = {
  data: MemoData;
  userId: string | null; // authenticated caller; tools scope to this id
  lat: number | null;
  lng: number | null;
  keys: { openai: string; perplexity: string; google: string };
  model: string;
  /** models_config.memo.perplexity — web_search tool binding (MESITA-942). */
  perplexityModel?: string;
  // OPTIONAL admin-only reasoning trace. Absent on the consumer path.
  trace?: TraceSink;
};

// What a tool hands back. `text` is the model-facing summary (public-safe,
// natural language — no raw ids). `predictions` optionally feeds the place-
// card rail (the existing frontend contract); `citations` are web sources.
export type ToolResult = {
  text: string;
  predictions?: Prediction[];
  citations?: string[];
  related?: string[]; // follow-up question suggestions (Perplexity surfaces these)
};

export type AirlockTool = {
  name: string;
  description: string; // the model reads this to decide when to call it
  schema: ToolSchema;
  // READ-ONLY handler. Receives already-validated args + the sealed context.
  run: (args: Record<string, unknown>, ctx: AirlockContext) => Promise<ToolResult>;
};

// ── Arg validation ─────────────────────────────────────────────────────

// Coerce + clamp model-supplied args to the tool's schema. Unknown keys are
// dropped; missing required keys throw (the dispatcher turns that into a
// benign "couldn't run that" rather than a crash). This is the parameter
// half of the airlock: the handler only ever sees values it declared.
function validateArgs(
  raw: unknown,
  schema: ToolSchema,
): Record<string, unknown> {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema.properties)) {
    if (!(key in obj)) continue;
    const v = obj[key];
    if (spec.type === "string") {
      if (typeof v !== "string") continue;
      let s = v;
      if (spec.maxLen && s.length > spec.maxLen) s = s.slice(0, spec.maxLen);
      if (spec.enum && !spec.enum.includes(s)) continue;
      out[key] = s;
    } else if (spec.type === "boolean") {
      if (typeof v === "boolean") out[key] = v;
    } else if (spec.type === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) continue;
      let m = n;
      if (spec.min != null) m = Math.max(spec.min, m);
      if (spec.max != null) m = Math.min(spec.max, m);
      if (spec.integer) m = Math.trunc(m);
      out[key] = m;
    }
  }
  for (const key of schema.required ?? []) {
    if (!(key in out)) throw new Error(`missing required arg: ${key}`);
  }
  return out;
}

// Render a tool's schema as an OpenAI function-tool spec.
function toOpenAiTool(t: AirlockTool) {
  const properties: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(t.schema.properties)) {
    const p: Record<string, unknown> = {
      type: spec.type,
      description: spec.description ?? "",
    };
    if (spec.type === "string" && spec.enum) p.enum = spec.enum;
    properties[key] = p;
  }
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties,
        required: t.schema.required ?? [],
        additionalProperties: false,
      },
    },
  };
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? v as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

// ── The airlock ────────────────────────────────────────────────────────

export class Airlock {
  private byName: Map<string, AirlockTool>;
  constructor(private tools: AirlockTool[], private ctx: AirlockContext) {
    this.byName = new Map(tools.map((t) => [t.name, t]));
  }

  openAiTools() {
    return this.tools.map(toOpenAiTool);
  }

  // Run one tool call from the model. A name the registry doesn't know, or
  // args that don't validate, yield a benign result — never an escalation and
  // never a throw that leaks a stack to the model. Every dispatch is recorded
  // to the trace when one is attached.
  async dispatch(name: string, rawArgs: unknown): Promise<ToolResult> {
    const start = Date.now();
    const tool = this.byName.get(name);
    if (!tool) {
      const result = { text: `No such capability: ${name}.` };
      this.record(name, {}, result, start);
      return result;
    }
    let args: Record<string, unknown>;
    try {
      args = validateArgs(rawArgs, tool.schema);
    } catch (e) {
      const result = { text: `Can't run ${name}: ${(e as Error).message}.` };
      this.record(name, {}, result, start);
      return result;
    }
    let result: ToolResult;
    try {
      result = await tool.run(args, this.ctx);
    } catch (e) {
      console.error(`[airlock] tool ${name} threw:`, (e as Error).message);
      result = { text: `Couldn't complete ${name} right now.` };
    }
    this.record(name, args, result, start);
    return result;
  }

  private record(
    name: string,
    args: Record<string, unknown>,
    result: ToolResult,
    start: number,
  ) {
    if (!this.ctx.trace) return;
    const source = toolSource(name);
    this.ctx.trace.push({
      kind: "tool",
      title: `${name} · ${source}`,
      source,
      tool: name,
      args,
      summary: clampSummary(result.text),
      predictions: result.predictions?.length ?? 0,
      citations: result.citations?.length ?? 0,
      ms: Date.now() - start,
    });
  }
}

// ── The OpenAI tool-calling loop ───────────────────────────────────────

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MAX_STEPS = 4; // tool-call rounds before we force a final answer

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
};

export type AgentOutput = {
  answer: string;
  predictions: Prediction[];
  citations: string[];
  related: string[];
};

// Drive the sealed model: it thinks, optionally calls airlock tools, sees the
// (public-safe) results, and finally answers in natural language. We collect
// place-card predictions + citations from whatever tools it used along the
// way. `messages` lets the caller prime the loop RAG-first (e.g. with a
// catalog recall already in context) per Pato's "RAG is central". Each round
// and the final answer are recorded to ctx.trace when one is attached.
export async function runAgent(
  airlock: Airlock,
  ctx: AirlockContext,
  messages: ChatMessage[],
): Promise<AgentOutput> {
  const predictions: Prediction[] = [];
  const citations: string[] = [];
  let related: string[] = [];
  const seenPlace = new Set<string>();
  const seenCite = new Set<string>();

  const absorb = (r: ToolResult) => {
    for (const p of r.predictions ?? []) {
      if (!seenPlace.has(p.placeId)) {
        seenPlace.add(p.placeId);
        predictions.push(p);
      }
    }
    for (const c of r.citations ?? []) {
      if (!seenCite.has(c)) {
        seenCite.add(c);
        citations.push(c);
      }
    }
    if (r.related && r.related.length > 0) related = r.related;
  };

  const tools = airlock.openAiTools();

  for (let step = 0; step < MAX_STEPS; step++) {
    const last = step === MAX_STEPS - 1;
    const t0 = Date.now();
    const res = await openAiChat(ctx, messages, last ? undefined : tools);
    const ms = Date.now() - t0;
    const choice = res?.choices?.[0]?.message;
    const calls = choice?.tool_calls ?? [];

    if (ctx.trace) {
      const content = (choice?.content ?? "").trim();
      ctx.trace.push({
        kind: "model",
        title: `OpenAI reasoning · round ${step + 1}`,
        source: "OpenAI",
        model: ctx.model,
        step,
        toolsOffered: !last,
        // On the answering round the content IS the reply (shown in the chat
        // bubble), so we don't duplicate it here; a planning round's content
        // is the model's thought.
        thought: calls.length > 0 ? (content.length > 0 ? content : null) : null,
        toolCalls: calls.map((c) => ({
          name: c.function.name,
          args: safeParseArgs(c.function.arguments),
        })),
        ms,
      });
    }

    if (!choice) break;

    if (calls.length === 0) {
      return {
        answer: (choice.content ?? "").trim(),
        predictions,
        citations,
        related,
      };
    }

    // Record the assistant turn that requested the tools, then answer each.
    messages.push({
      role: "assistant",
      content: choice.content ?? null,
      tool_calls: calls,
    });
    for (const call of calls) {
      const parsed = safeParseArgs(call.function.arguments);
      const result = await airlock.dispatch(call.function.name, parsed);
      absorb(result);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.text,
      });
    }
  }

  // Ran out of steps mid-tool-use — ask once more for a plain answer.
  const tF = Date.now();
  const finalRes = await openAiChat(ctx, messages, undefined);
  const finalMs = Date.now() - tF;
  const answer = (finalRes?.choices?.[0]?.message?.content ?? "").trim();
  if (ctx.trace) {
    ctx.trace.push({
      kind: "model",
      title: "OpenAI reasoning · final answer",
      source: "OpenAI",
      model: ctx.model,
      step: MAX_STEPS,
      toolsOffered: false,
      thought: null,
      toolCalls: [],
      ms: finalMs,
    });
  }
  return { answer, predictions, citations, related };
}

type ChatResponse = {
  choices?: { message?: ChatMessage }[];
};

async function openAiChat(
  ctx: AirlockContext,
  messages: ChatMessage[],
  tools: unknown[] | undefined,
): Promise<ChatResponse | null> {
  const body: Record<string, unknown> = {
    model: ctx.model,
    messages,
    temperature: 0.5,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const r = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.keys.openai}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    console.error("[airlock] openai HTTP", r.status, (await r.text()).slice(0, 240));
    return null;
  }
  return (await r.json()) as ChatResponse;
}

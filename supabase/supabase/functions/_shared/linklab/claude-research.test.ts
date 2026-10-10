// MESITA-2118 — strategy G's request loop, replayed against canned Messages API
// responses (no network, no key). Pins the request shape, submit_links extraction,
// pause_turn resumption, the prose fallback, and the `only` filter that keeps a
// one-strategy run from billing the other six.

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import type Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { runClaudeResearch } from "./providers.ts";
import { runAllStrategies } from "./strategies.ts";
import type { PlaceContext } from "./context.ts";

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Msg = Anthropic.Beta.Messages.BetaMessage;

const SCHEMA = {
  type: "object",
  properties: {
    website_url: { type: ["string", "null"] },
    instagram_url: { type: ["string", "null"] },
  },
  required: ["website_url", "instagram_url"],
};

function msg(
  stop: Msg["stop_reason"],
  content: unknown[],
  usage: { in?: number; out?: number; searches?: number; fetches?: number } = {},
): Msg {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    stop_reason: stop,
    content,
    usage: {
      input_tokens: usage.in ?? 100,
      output_tokens: usage.out ?? 10,
      server_tool_use: {
        web_search_requests: usage.searches ?? 0,
        web_fetch_requests: usage.fetches ?? 0,
      },
    },
  } as unknown as Msg;
}

function replay(responses: (Msg | Error)[]) {
  const calls: Params[] = [];
  const create = (p: Params) => {
    calls.push(structuredClone(p));
    const next = responses.shift();
    if (!next) throw new Error("no more canned responses");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { calls, create };
}

const SUBMIT = {
  type: "tool_use",
  id: "toolu_1",
  name: "submit_links",
  input: { website_url: null, instagram_url: "https://www.instagram.com/dosamores.brunch" },
};

Deno.test("G: the request carries both server tools, a strict submit tool and the fallback", async () => {
  const { calls, create } = replay([msg("tool_use", [SUBMIT])]);
  await runClaudeResearch(create, "sys", "user", SCHEMA);
  const p = calls[0];
  assertEquals(p.model, "claude-opus-5-5");
  assertEquals(p.fallbacks, "default");
  assertEquals(p.betas, ["server-side-fallback-2026-07-01"]);
  const tools = (p.tools ?? []) as unknown as Record<string, unknown>[];
  assertEquals(tools.map((t) => t.type ?? t.name), [
    "web_search_20260209",
    "web_fetch_20260209",
    "submit_links",
  ]);
  const submit = tools[2] as { strict: boolean; input_schema: Record<string, unknown> };
  assertEquals(submit.strict, true);
  assertEquals(submit.input_schema.additionalProperties, false);
});

Deno.test("G: the answer is the submit_links input, and usage is reported", async () => {
  const { create } = replay([msg("tool_use", [SUBMIT], { in: 900, out: 40, searches: 3, fetches: 2 })]);
  const r = await runClaudeResearch(create, "sys", "user", SCHEMA);
  assertEquals(r.answer, SUBMIT.input);
  assertEquals([r.searches, r.fetches, r.inputTokens, r.outputTokens], [3, 2, 900, 40]);
  assertEquals(r.error, undefined);
});

Deno.test("G: pause_turn resends the paused turn with no extra user message, usage sums", async () => {
  const paused = [{ type: "text" as const, text: "Searching…" }];
  const { calls, create } = replay([
    msg("pause_turn", paused, { searches: 4 }),
    msg("tool_use", [SUBMIT], { searches: 1, fetches: 1 }),
  ]);
  const r = await runClaudeResearch(create, "sys", "user", SCHEMA);
  assertEquals(calls.length, 2);
  assertEquals(calls[1].messages.map((m) => m.role), ["user", "assistant"]);
  assertEquals(calls[1].messages[1].content, paused);
  assertEquals([r.searches, r.fetches], [5, 1]);
  assertEquals(r.answer, SUBMIT.input);
});

Deno.test("G: a prose answer with a JSON object still parses", async () => {
  const { create } = replay([
    msg("end_turn", [{ type: "text", text: 'Done: {"website_url": "https://pujol.com.mx", "instagram_url": null}' }]),
  ]);
  const r = await runClaudeResearch(create, "sys", "user", SCHEMA);
  assertEquals(r.answer, { website_url: "https://pujol.com.mx", instagram_url: null });
});

Deno.test("G: an API error degrades to an empty answer instead of throwing", async () => {
  const { create } = replay([new Error("529 overloaded")]);
  const r = await runClaudeResearch(create, "sys", "user", SCHEMA);
  assertEquals(r.answer, {});
  assertExists(r.error);
});

Deno.test("G: endless pause_turn stops after the continuation cap", async () => {
  const pauses = Array.from({ length: 6 }, () => msg("pause_turn", [{ type: "text", text: "…" }]));
  const { calls, create } = replay(pauses);
  const r = await runClaudeResearch(create, "sys", "user", SCHEMA);
  assertEquals(calls.length, 5);
  assertEquals(r.error, "pause_turn continuations exhausted");
});

Deno.test("runAllStrategies: `only` runs just those strategies", async () => {
  const ctx: PlaceContext = {
    name: "Dos Amores",
    city: "San Luis Potosí",
    locationLine: "Parque Central 455, San Luis Potosí",
    google: null,
    seedWebsite: null,
    serpSummary: null,
  };
  // No anthropic key: G answers without touching the network, every other strategy
  // would have called a provider — so the result keys prove which ones ran.
  const out = await runAllStrategies(ctx, { firecrawl: "", perplexity: "", google: "", anthropic: "" }, ["G"]);
  assertEquals(Object.keys(out), ["G"]);
  assertEquals(out.G.debug?.error, "no ANTHROPIC_API_KEY");
});

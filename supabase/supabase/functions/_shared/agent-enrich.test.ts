import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { AGENT_ENRICH_MAX, agentEnrichIds, FIRECRAWL_FLOOR, startAgentEnrich } from "./agent-enrich.ts";

// Money: an agent start must never reach Render (or the catalog) when
// Firecrawl cannot pay for Links, nor carry more than AGENT_ENRICH_MAX places.

const ENV = { get: (n: string) => (n === "FIRECRAWL_KEY" || n === "RENDER_KEY" ? "key" : undefined) };

function vendors(remaining: number | null) {
  const render: unknown[] = [];
  const fetchImpl = ((url: string, init?: RequestInit) => {
    if (url.includes("firecrawl")) {
      return Promise.resolve(new Response(JSON.stringify({ data: remaining === null ? {} : { remainingCredits: remaining } })));
    }
    render.push(init?.body);
    return Promise.resolve(new Response("{}"));
  }) as unknown as typeof fetch;
  return { render, fetchImpl };
}

const untouchable = {
  from: () => {
    throw new Error("the catalog must not be read");
  },
} as unknown as SupabaseClient;

Deno.test("agent enrich refuses under the Firecrawl floor and calls nothing else", async () => {
  for (const remaining of [null, 0, FIRECRAWL_FLOOR - 1]) {
    const { render, fetchImpl } = vendors(remaining);
    const res = await startAgentEnrich(untouchable, ["ChIJa"], { env: ENV, fetchImpl });
    assertEquals(res.ok, false);
    assertEquals(res.ok ? 0 : res.status, 402);
    assertEquals(render.length, 0);
  }
});

Deno.test("agent enrich carries at most the cap, unique and trimmed", () => {
  assertEquals(agentEnrichIds([" a ", "a", "b"]), { ok: true, ids: ["a", "b"] });
  assertEquals(agentEnrichIds([]).ok, false);
  assertEquals(agentEnrichIds("a").ok, false);
  assertEquals(agentEnrichIds(Array.from({ length: AGENT_ENRICH_MAX + 1 }, (_, i) => `id${i}`)).ok, false);
});

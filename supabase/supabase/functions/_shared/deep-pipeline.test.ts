// The Deep pipeline (MESITA-2327): lazy, Description-ranked, Chat-facing.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { deepContextForChat, type DeepRow, runDeepPipeline } from "./deep-pipeline.ts";

const row = (id: string, embedding: unknown, over: Partial<DeepRow> = {}): DeepRow => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  address: "Roma Nte.",
  family_keys: ["drinks"],
  google_stars_overall: 4.6,
  google_review_count: 300,
  description: "A dim jazz bar with a short cocktail list.",
  embedding,
  ...over,
});

function deps(rows: DeepRow[] | null, vector: number[] | null = [1, 0]) {
  let embeds = 0;
  let pools = 0;
  return {
    counts: () => ({ embeds, pools }),
    d: {
      query: "an intimate jazz bar",
      config: { limit: 5, minSimilarity: 0 },
      embed: (_: string) => {
        embeds++;
        return Promise.resolve(vector);
      },
      pool: () => {
        pools++;
        return Promise.resolve(rows);
      },
    },
  };
}

Deno.test("deep: the query is embedded once and places rank by Description", async () => {
  const { d, counts } = deps([
    row("loose", [0.6, 0.8]),
    row("close", [0.95, 0.31]),
    row("exact", [1, 0]),
  ]);
  const out = await runDeepPipeline(d);
  assertEquals(out.places.map((p) => p.id), ["exact", "close", "loose"]);
  assertEquals(counts().embeds, 1);
  assert(out.places[0].similarity > out.places[1].similarity);
});

Deno.test("deep is lazy: a query too short to describe anything embeds nothing", async () => {
  const { d, counts } = deps([row("a", [1, 0])]);
  const out = await runDeepPipeline({ ...d, query: " a " });
  assertEquals(out, { places: [], embedded: false });
  assertEquals(counts(), { embeds: 0, pools: 0 });
});

Deno.test("deep missing data: a place without a summary vector is left out, not ranked last", async () => {
  const { d } = deps([row("no-vector", null), row("ok", [1, 0])]);
  const out = await runDeepPipeline(d);
  assertEquals(out.places.map((p) => p.id), ["ok"]);
});

Deno.test("deep: the floor and the limit come from the Deep box", async () => {
  const { d } = deps([row("hi", [1, 0]), row("lo", [0.2, 0.98]), row("mid", [0.8, 0.6])]);
  const floored = await runDeepPipeline({ ...d, config: { limit: 5, minSimilarity: 0.5 } });
  assertEquals(floored.places.map((p) => p.id), ["hi", "mid"]);
  const limited = await runDeepPipeline({ ...d, config: { limit: 1, minSimilarity: 0 } });
  assertEquals(limited.places.map((p) => p.id), ["hi"]);
});

Deno.test("deep fails soft: no vector or no pool is an empty answer", async () => {
  assertEquals((await runDeepPipeline(deps([row("a", [1, 0])], null).d)).places, []);
  assertEquals((await runDeepPipeline(deps(null).d)).places, []);
});

Deno.test("chat context names only Deep's places, best first", async () => {
  const { d } = deps([row("exact", [1, 0])]);
  const out = await runDeepPipeline(d);
  const ctx = deepContextForChat(out.places);
  assert(ctx.includes("1. EXACT"));
  assert(ctx.includes("never invent"));
  assertEquals(deepContextForChat([]), "");
});

Deno.test("the Chat Agent calls the Deep pipeline, never a source", async () => {
  const chat = await Deno.readTextFile(new URL("../consumer-web-ask-memo/index.ts", import.meta.url));
  assert(chat.includes("runDeepPipeline("));
  for (const source of [
    'from("profiles")',
    "searchNearbyPlaces",
    "fetchTextSearch",
    "fetchAutocomplete",
    "embedSingle",
  ]) {
    assertEquals(chat.includes(source), false, source);
  }
});

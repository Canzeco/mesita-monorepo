// The Deep pipeline (MESITA-2327): lazy, Description-ranked, Chat-facing.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { type DeepRow, runDeepPipeline } from "./deep-pipeline.ts";
import { chatContextForModel } from "./chat-agent.ts";
import { SYSTEM_PROMPT } from "./memo-prompt.ts";

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

Deno.test("the Chat Agent calls the Deep pipeline, never a source", async () => {
  const chat = await Deno.readTextFile(new URL("../consumer-web-ask-memo/index.ts", import.meta.url));
  assert(chat.includes("runDeepPipeline("));
  for (const source of [
    'from("profiles")',
    "searchNearbyPlaces",
    "fetchTextSearch",
    "fetchAutocomplete",
    "embedSingle",
    // The Google-backed wrappers too: Chat names only Mesita places.
    "selectGooglePlaces",
    "runConsumerSearchLane",
    "searchNearby",
  ]) {
    assertEquals(chat.includes(source), false, source);
  }
});

// ── MESITA-2338: the Chat wire, the persona and Memo's data paths ──────────

Deno.test("Chat keeps `related` as follow-up strings and sends Deep's places as `places`", async () => {
  const chat = await Deno.readTextFile(new URL("../consumer-web-ask-memo/index.ts", import.meta.url));
  // The client renders each `related` item as a string chip.
  assertEquals(/related:\s*related\b|related:\s*places\b|related:\s*\w+\.map\(/.test(chat), false);
  assert(chat.includes("places: places.map("));
});

Deno.test("the persona allows recommending from Deep's list and never contradicts it", () => {
  assertEquals(SYSTEM_PROMPT.includes("Do not pretend you queried Mesita"), false);
  assertEquals(SYSTEM_PROMPT.includes("cannot look up Google Places, Perplexity, the Mesita catalog"), false);
  assert(SYSTEM_PROMPT.includes("only from that list"));
  // The context the model really gets (MESITA-2339) says Mesita looked the
  // places up, matching the persona.
  assert(chatContextForModel([{
    id: "a",
    slug: null,
    name: "A",
    address: null,
    familyKeys: [],
    rating: null,
    reviewCount: null,
    about: null,
    distanceKm: null,
    why: "deep",
  }], { hasAnchor: false }).includes("Mesita looked these places up"));
});

Deno.test("Memo's only database client feeds the config read and the three pipelines", async () => {
  const chat = await Deno.readTextFile(new URL("../consumer-web-ask-memo/index.ts", import.meta.url));
  const uses = chat.match(/adminClient\(/g) ?? [];
  assertEquals(uses.length, 1);
  const fn = chat.slice(chat.indexOf("async function chatPlacesFor"));
  assert(fn.includes("adminClient(env)"));
  assert(fn.includes("loadDiscoveryConfig(admin)"));
  // The client reaches data only through the pipeline modules (MESITA-2339).
  assert(chat.includes("nameMesitaPlaces(admin,"));
  assert(chat.includes("areaSelectedPlaces(admin,"));
  assert(chat.includes("deepDepsFor(admin,"));
  // Any member call, however the chain is wrapped (imports read `from "…"`).
  assertEquals(/\.\s*(from|rpc)\s*\(/.test(chat), false);
  assertEquals(chat.includes("createClient("), false);
});

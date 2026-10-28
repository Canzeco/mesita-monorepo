// The Discovery model (MESITA-2327) against itself and against the call
// sites: four sources, three pipelines, four signals, two gates, and no
// relationship the engines do not have.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DISCOVERY_GATES,
  DISCOVERY_PIPELINES,
  DISCOVERY_SIGNALS,
  DISCOVERY_SOURCES,
  pipelinesUsingGate,
  pipelinesUsingSignal,
  pipelinesUsingSource,
  sourceProvides,
  sourcesFeedingSignal,
} from "./discovery-surface.ts";
import {
  SCREEN_RADIUS_KM_MIN,
} from "./area-pipeline.ts";
import { NEARBY_SCAN_LIMIT } from "./geo.ts";

const root = new URL("../../", import.meta.url);
const text = (rel: string) => Deno.readTextFile(new URL(rel, root));

Deno.test("the model is Pato's: four sources (Google Nearby gone, MESITA-2872), Name · Area · Deep, three signals (Name gone, MESITA-2896), two gates", () => {
  assertEquals(DISCOVERY_SOURCES.map((s) => s.label), [
    "Google Autocomplete",
    "Google Text Search",
    "Mesita Places Search",
    "Mesita Social Search",
  ]);
  assertEquals(DISCOVERY_PIPELINES.map((p) => p.label), ["Name", "Map", "Catalog", "Deep"]);
  assertEquals(DISCOVERY_SIGNALS.map((s) => s.label), ["Description", "Proximity", "Popularity"]);
  assertEquals(DISCOVERY_GATES.map((g) => g.label), ["Family", "Radius"]);
  // The Map ranks by Popularity alone; only the Catalog reads Proximity and
  // only the Map gates on a radius (MESITA-2909).
  assertEquals(pipelinesUsingSignal("proximity"), ["catalog"]);
  assertEquals(pipelinesUsingSignal("popularity"), ["map", "catalog"]);
  assertEquals(pipelinesUsingSignal("description_similarity"), ["deep"]);
  assertEquals(pipelinesUsingGate("radius"), ["map"]);
  assertEquals(pipelinesUsingGate("family"), ["map", "catalog"]);
});

Deno.test("collections are not pipelines; the Chat Agent is a caller, never a source", () => {
  const labels = DISCOVERY_PIPELINES.map((p) => p.label.toLowerCase());
  for (const notAPipeline of ["favorites", "chat", "search"]) {
    assertEquals(labels.some((l) => l.includes(notAPipeline)), false, notAPipeline);
  }
  assertEquals(DISCOVERY_PIPELINES.find((p) => p.key === "deep")?.callers, ["Chat (Don Memo)"]);
  // The Chat Agent calls Name, Catalog and Deep (MESITA-2339, MESITA-2909)
  // and is none of them; the Map is the Search tab's alone.
  for (const p of DISCOVERY_PIPELINES) {
    assertEquals(p.callers.includes("Chat (Don Memo)"), p.key !== "map", p.key);
  }
  assertEquals(DISCOVERY_SOURCES.some((s) => /chat|exa|perplexity|provider/i.test(s.label)), false);
});

Deno.test("every pipeline signal is fed by one of its own sources (derived from fields)", () => {
  for (const p of DISCOVERY_PIPELINES) {
    for (const sig of p.signals) {
      assert(sourcesFeedingSignal(p.key, sig).length > 0, `${p.key}/${sig}`);
    }
  }
  assertEquals(sourcesFeedingSignal("catalog", "proximity"), ["mesita_places"]);
  assertEquals(sourcesFeedingSignal("deep", "description_similarity"), ["mesita_places"]);
  // Name is Google's two sources in Google's order: no signal (MESITA-2896).
  assertEquals(DISCOVERY_PIPELINES.find((p) => p.key === "name")?.signals, []);
  // Autocomplete answers with no coordinates, so it can never feed Proximity.
  assertEquals(sourceProvides("google_autocomplete", ["coordinates"]), false);
});

Deno.test("every gate pushdown names a source that provides the gate's field", () => {
  for (const g of DISCOVERY_GATES) {
    for (const s of g.pushdown) assert(sourceProvides(s, g.requires), `${g.key}/${s}`);
  }
  assertEquals(pipelinesUsingSource("mesita_social"), ["deep"]);
  assertEquals(DISCOVERY_SOURCES.find((s) => s.key === "mesita_social")?.live, false);
});

Deno.test("the call sites match the model", async () => {
  const name = await text("functions/_shared/consumer-search-lane.ts");
  const area = await text("functions/_shared/area-pipeline.ts");
  const deep = await text("functions/_shared/deep-pipeline.ts");
  const map = await text("functions/consumer-web-list-places/index.ts");
  const feed = await text("functions/consumer-web-list-catalog/index.ts");
  const chat = await text("functions/consumer-web-ask-memo/index.ts");

  // Name: Autocomplete · Text Search, Google's order; no Mesita name lane
  // (MESITA-2896).
  assert(name.includes("fetchAutocomplete") && name.includes("fetchTextSearch"));
  assertEquals(/fetchEmbedPool|rankMesitaByName/.test(name), false);
  // Map and Catalog (Area until MESITA-2909): Mesita Places only, one engine; both EFs are its
  // views. No Google Nearby anywhere (MESITA-2872).
  assert(area.includes("mesitaPoolQuery") && area.includes("rankArea"));
  assert(map.includes("selectAreaPool") && feed.includes("selectAreaPool"));
  for (const src of [name, area, deep, map, feed]) {
    assertEquals(/searchNearby|areaQuota/.test(src), false);
  }
  // The Area's views hold no Google key at all.
  assertEquals(/readGooglePlacesKey/.test(area + map + feed), false);
  assertEquals(/selectGooglePlaces|selectMesitaSelected/.test(map + feed), false);
  // Deep: Mesita Places by Description, and nothing Google.
  assert(deep.includes("descriptionSimilarity"));
  assertEquals(/fetchTextSearch|fetchAutocomplete/.test(deep), false);
  // Chat calls the Deep pipeline and no source.
  assert(chat.includes("runDeepPipeline("));
  // No weights on Area: the blend and the lineup are gone from it.
  assertEquals(/rankByBlend|weightsForMode|mapLineupWeights|catalogScore/.test(area), false);
});

// ── MESITA-2338: every definition the spec asks for, and honest relations ──

Deno.test("every signal states computation, cost, missing data and normalization", () => {
  for (const sig of DISCOVERY_SIGNALS) {
    assert(sig.requires.length > 0, sig.key);
    assert(sig.query.length > 0, sig.key);
    assert(["runtime", "precomputed", "hybrid"].includes(sig.computation), sig.key);
    assert(sig.cost.length > 0 && sig.missing.length > 0 && sig.normalization.length > 0, sig.key);
    assert(pipelinesUsingSignal(sig.key).length > 0, sig.key);
  }
});

Deno.test("a source a pipeline keeps in its own order is one of its sources and feeds nothing", () => {
  for (const p of DISCOVERY_PIPELINES) {
    for (const s of p.keepsOrder) {
      assert(p.sources.includes(s), `${p.key}/${s}`);
      for (const sig of p.signals) {
        assertEquals(sourcesFeedingSignal(p.key, sig).includes(s), false, `${p.key}/${s}/${sig}`);
      }
    }
  }
});

Deno.test("every pipeline discloses its always-on rules; the Name type rule is one of them", () => {
  for (const p of DISCOVERY_PIPELINES) assert(p.rules.length > 0, p.key);
  const name = DISCOVERY_PIPELINES.find((p) => p.key === "name")!;
  assert(name.rules.some((r) => r.includes("Google type")));
  assertEquals(name.gates.length, 0);
});

Deno.test("Deep's evidence (the About) is a field Mesita Places Search declares", () => {
  const mesita = DISCOVERY_SOURCES.find((s) => s.key === "mesita_places")!;
  assert(mesita.provides.includes("about"));
});

Deno.test("Deep is not live while no guest reaches Chat; Name, Map and Catalog are (MESITA-2345)", () => {
  const live = Object.fromEntries(DISCOVERY_PIPELINES.map((p) => [p.key, p.live]));
  assertEquals(live, { name: true, map: true, catalog: true, deep: false });
});

// ── MESITA-2379: one pool; MESITA-2872: two Mesita sources;
//    MESITA-2925: Premier is the factor, never a signal ──────────────────

Deno.test("Map: Family and Radius gate, Popularity × the Premier factor (MESITA-2909, MESITA-2925)", () => {
  const map = DISCOVERY_PIPELINES.find((p) => p.key === "map")!;
  assertEquals(map.gates, ["family", "radius"]);
  assertEquals(map.signals, ["popularity"]);
  assertEquals(map.factors.length, 1);
  assert(map.factors[0].startsWith("Premier (MESITA-2925)"));
  assert(map.scoring.startsWith("Popularity × s"));
  assertEquals(JSON.stringify(map).includes("rectangle"), false);
});

Deno.test("Catalog: Family only, Proximity × Popularity × the Premier factor, Chat reads every ready place (MESITA-2909, MESITA-2925)", () => {
  const catalog = DISCOVERY_PIPELINES.find((p) => p.key === "catalog")!;
  assertEquals(catalog.gates, ["family"]);
  assertEquals(catalog.signals, ["proximity", "popularity"]);
  assert(catalog.scoring.startsWith("Proximity × Popularity × s"));
  assert(catalog.rules.includes("Chat reads every ready Mesita place inside the current-location radius (Selected only until MESITA-2925)."));
  assert(catalog.callers.includes("Chat (Don Memo)"));
  for (const p of [catalog, DISCOVERY_PIPELINES.find((x) => x.key === "map")!]) {
    for (const stale of ["scope", "subset", "rail", "Mesita Proximity", "Distance penalty"]) {
      assertEquals(JSON.stringify(p).includes(stale), false, stale);
    }
  }
});

// MESITA-2603: Territory is gone from the model, and every fixed number the
// Area rules state is the engine's own constant, so the page cannot drift.
Deno.test("Area: no Territory anywhere in the model; the rules' numbers are the engine's", async () => {
  const model = JSON.stringify({ DISCOVERY_GATES, DISCOVERY_PIPELINES, DISCOVERY_SIGNALS, DISCOVERY_SOURCES });
  assertEquals(model.toLowerCase().includes("territory\""), false);
  assertEquals(DISCOVERY_GATES.map((g) => g.key), ["family", "radius"]);
  const rules = DISCOVERY_PIPELINES.find((p) => p.key === "map")!.rules.join(" ");
  const facts = [
    "the Map calls no Google",
    `at least ${SCREEN_RADIUS_KM_MIN} km and has no ceiling`,
    `at most ${NEARBY_SCAN_LIMIT} ready rows`,
  ];
  for (const f of facts) assert(rules.includes(f), f);
  // Home's Mesita read keeps the same cap as the Map's.
  const home = await text("functions/consumer-web-list-catalog/index.ts");
  assert(home.includes(`const POOL_CAP = ${NEARBY_SCAN_LIMIT};`));
});


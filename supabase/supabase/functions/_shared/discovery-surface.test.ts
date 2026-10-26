// The Discovery model (MESITA-2327) against itself and against the call
// sites: five sources, three pipelines, four signals, two gates, and no
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
  AREA_BOUNDS_MAX_KM,
  SCREEN_RADIUS_KM_MAX,
  SCREEN_RADIUS_KM_MIN,
} from "./area-pipeline.ts";
import { GOOGLE_NEARBY_MAX } from "./nearby-places.ts";
import { GOOGLE_NEARBY_GLOBAL_MAX, GOOGLE_NEARBY_IP_MAX } from "./nearby-google-quota.ts";
import { NEARBY_SCAN_LIMIT } from "./geo.ts";

const root = new URL("../../", import.meta.url);
const text = (rel: string) => Deno.readTextFile(new URL(rel, root));

Deno.test("the model is Pato's: five sources, Name · Area · Deep, four signals, two gates", () => {
  assertEquals(DISCOVERY_SOURCES.map((s) => s.label), [
    "Google Autocomplete",
    "Google Text Search",
    "Google Nearby Search",
    "Mesita Places Search",
    "Mesita Social Search",
  ]);
  assertEquals(DISCOVERY_PIPELINES.map((p) => p.label), ["Name", "Area", "Deep"]);
  assertEquals(DISCOVERY_SIGNALS.map((s) => s.label), ["Name", "Description", "Proximity", "Popularity"]);
  assertEquals(DISCOVERY_GATES.map((g) => g.label), ["Family", "Radius"]);
  assertEquals(pipelinesUsingSignal("proximity"), ["area"]);
  assertEquals(pipelinesUsingSignal("popularity"), ["area"]);
  assertEquals(pipelinesUsingSignal("name_similarity"), ["name"]);
  assertEquals(pipelinesUsingSignal("description_similarity"), ["deep"]);
  assertEquals(pipelinesUsingGate("radius"), ["area"]);
  assertEquals(pipelinesUsingGate("family"), ["area"]);
});

Deno.test("views and collections are not pipelines; the Chat Agent is a caller, never a source", () => {
  const labels = DISCOVERY_PIPELINES.map((p) => p.label.toLowerCase());
  for (const notAPipeline of ["catalog", "map", "favorites", "chat", "search"]) {
    assertEquals(labels.some((l) => l.includes(notAPipeline)), false, notAPipeline);
  }
  assertEquals(DISCOVERY_PIPELINES.find((p) => p.key === "deep")?.callers, ["Chat (Don Memo)"]);
  // The Chat Agent calls all three pipelines (MESITA-2339) and is none of them.
  for (const p of DISCOVERY_PIPELINES) assert(p.callers.includes("Chat (Don Memo)"), p.key);
  assertEquals(DISCOVERY_SOURCES.some((s) => /chat|exa|perplexity|provider/i.test(s.label)), false);
});

Deno.test("every pipeline signal is fed by one of its own sources (derived from fields)", () => {
  for (const p of DISCOVERY_PIPELINES) {
    for (const sig of p.signals) {
      assert(sourcesFeedingSignal(p.key, sig).length > 0, `${p.key}/${sig}`);
    }
  }
  assertEquals(sourcesFeedingSignal("area", "proximity"), ["google_nearby", "mesita_places"]);
  assertEquals(sourcesFeedingSignal("deep", "description_similarity"), ["mesita_places"]);
  // Google rows keep Google's order in the Name pipeline: no signal scores
  // them, so neither Google source is derived as feeding Name (MESITA-2338).
  assertEquals(sourcesFeedingSignal("name", "name_similarity"), ["mesita_places"]);
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

  // Name: Autocomplete · Text Search · Mesita Places, ranked by the Name signal.
  assert(name.includes("fetchAutocomplete") && name.includes("fetchTextSearch") && name.includes("fetchEmbedPool"));
  assert(name.includes("nameSimilarity"));
  assertEquals(name.includes("searchNearbyPlaces"), false);
  // Area: Nearby · Mesita Places, the Area score; Map and the Catalog are its views.
  assert(area.includes("searchNearbyPlaces") && area.includes("selectedPoolQuery") && area.includes("rankArea"));
  assert(map.includes("selectAreaPool") && feed.includes("selectAreaPool"));
  assertEquals(/selectGooglePlaces|selectMesitaSelected/.test(map + feed), false);
  // Deep: Mesita Places by Description, and nothing Google.
  assert(deep.includes("descriptionSimilarity"));
  assertEquals(/searchNearbyPlaces|fetchTextSearch|fetchAutocomplete/.test(deep), false);
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

Deno.test("Deep is not live while no guest reaches Chat; Name and Area are (MESITA-2345)", () => {
  const live = Object.fromEntries(DISCOVERY_PIPELINES.map((p) => [p.key, p.live]));
  assertEquals(live, { name: true, area: true, deep: false });
});

// ── MESITA-2379: one pool; MESITA-2703: four sources, two weights;
//    MESITA-2717: Selected is back as a factor, never a signal ────────────

Deno.test("Area: Family and Radius gate, Proximity × Popularity × the Selected boost, Chat reads Selected only", () => {
  const area = DISCOVERY_PIPELINES.find((p) => p.key === "area")!;
  assertEquals(area.gates, ["family", "radius"]);
  assertEquals(area.signals, ["proximity", "popularity"]);
  assertEquals(area.factors.length, 1);
  assert(area.factors[0].startsWith("Selected (MESITA-2717)"));
  assert(area.scoring.startsWith("The Map and Home: Proximity × Popularity × s"));
  assert(area.scoring.includes("Selected boost"));
  assertEquals(JSON.stringify(area).includes("rectangle"), false);
  for (const src of ["Google Popular", "Google Closest", "Mesita Popular", "Mesita Closest"]) {
    assert(area.rules.some((r) => r.includes(src)), src);
  }
  assert(area.rules.includes("Chat reads Mesita Selected places only, inside the current-location radius."));
  assert(area.callers.includes("Chat (Don Memo)"));
  for (const stale of ["scope", "subset", "rail"]) {
    assertEquals(JSON.stringify(area).toLowerCase().includes(stale), false, stale);
  }
});

// MESITA-2603: Territory is gone from the model, and every fixed number the
// Area rules state is the engine's own constant, so the page cannot drift.
Deno.test("Area: no Territory anywhere in the model; the rules' numbers are the engine's", async () => {
  const model = JSON.stringify({ DISCOVERY_GATES, DISCOVERY_PIPELINES, DISCOVERY_SIGNALS, DISCOVERY_SOURCES });
  assertEquals(model.toLowerCase().includes("territory\""), false);
  assertEquals(DISCOVERY_GATES.map((g) => g.key), ["family", "radius"]);
  const rules = DISCOVERY_PIPELINES.find((p) => p.key === "area")!.rules.join(" ");
  const facts = [
    `Google Popular (the prominent ${GOOGLE_NEARBY_MAX} in the circle)`,
    "never cached or stored",
    `${GOOGLE_NEARBY_IP_MAX} Nearby calls a minute, all guests together ${GOOGLE_NEARBY_GLOBAL_MAX}`,
    `clamped to ${SCREEN_RADIUS_KM_MIN}–${SCREEN_RADIUS_KM_MAX} km`,
    `wider than ${AREA_BOUNDS_MAX_KM} km`,
    `at most ${NEARBY_SCAN_LIMIT} ready rows`,
  ];
  for (const f of facts) assert(rules.includes(f), f);
  // Home's Mesita read keeps the same cap as the Map's.
  const home = await text("functions/consumer-web-list-catalog/index.ts");
  assert(home.includes(`const POOL_CAP = ${NEARBY_SCAN_LIMIT};`));
});


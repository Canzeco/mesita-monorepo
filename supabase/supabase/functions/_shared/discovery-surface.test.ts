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
  assertEquals(DISCOVERY_GATES.map((g) => g.label), ["Selected", "Family"]);
  assertEquals(pipelinesUsingSignal("proximity"), ["area"]);
  assertEquals(pipelinesUsingSignal("popularity"), ["area"]);
  assertEquals(pipelinesUsingSignal("name_similarity"), ["name"]);
  assertEquals(pipelinesUsingSignal("description_similarity"), ["deep"]);
  assertEquals(pipelinesUsingGate("selected"), ["area"]);
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
  // Area: Nearby · Mesita Places, the Area score; Map and the Feed are its views.
  assert(area.includes("searchNearbyPlaces") && area.includes("selectedPoolQuery") && area.includes("rankArea"));
  assert(map.includes("selectGooglePlaces") && map.includes("selectMesitaSelected"));
  assert(feed.includes("selectGooglePlaces") && feed.includes("selectMesitaSelected"));
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

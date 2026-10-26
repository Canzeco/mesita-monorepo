import { assertEquals } from "jsr:@std/assert@1";
import { RESOLVER_INSTRUCTIONS } from "./enrich-channel-discovery.ts";
import { buildScoutInput, SCOUT_INSTRUCTIONS } from "./enrich-serp.ts";
import {
  contentStateAfterRefusal,
  ENRICHING_PATCH,
  enrichmentKnobs,
  enrichmentRun,
  renderApiKey,
  scoutInputFor,
} from "./enrich-start.ts";

const ONE = { placeId: "place-1", googlePlaceId: "ChIJ-1" };
const TWO = { placeId: "place-2", googlePlaceId: "ChIJ-2" };

Deno.test("one place starts enrich single place with its Google id", () => {
  assertEquals(enrichmentRun([ONE]), {
    task: "mesita-monorepo/enrich-single-place",
    input: [ONE],
  });
});

Deno.test("enriching is the state alone, not a profile field", () => {
  assertEquals(ENRICHING_PATCH, { content_state: "generating" });
  assertEquals(Object.keys(ENRICHING_PATCH), ["content_state"]);
});

Deno.test("the Render key is the secret that exists", () => {
  const env = {
    get(name: string) {
      if (name === "RENDER_KEY") return " live-key ";
      if (name === "RENDER_API_KEY") return "old-key";
      return undefined;
    },
  };
  assertEquals(renderApiKey(env), "live-key");
  assertEquals(renderApiKey({ get: (name) => name === "RENDER_API_KEY" ? "old-key" : undefined }), "old-key");
  assertEquals(renderApiKey({ get: () => undefined }), "");
});

Deno.test("the Enrichment page rides on the job, with the Scout and Resolver texts the console shows", () => {
  const knobs = enrichmentKnobs({
    discoverCandidates: {
      website_url: 5,
      instagram_url: 7,
      facebook_url: 3,
      opentable_url: 3,
      uber_eats_url: 3,
    },
    perplexityPreset: "pro-search",
    visionQuality: "economy",
    synthesisQuality: "standard",
    gatherGoogleImages: 10,
    gatherInstagramDepth: 10,
    analyzeGoogleImages: 10,
    analyzeInstagramImages: 10,
    saveTotalImages: 10,
    visionEnabled: true,
    saveImagesToStorage: true,
    imageAnalysisPrompt: "describe the room",
    imageSortingPrompt: "best room first",
  });
  assertEquals(knobs.discoverInstagramN, 7);
  assertEquals(knobs.visionModel, "gpt-4o-mini");
  assertEquals(knobs.sortModel, "gpt-4o");
  assertEquals(knobs.resolverInstructions, RESOLVER_INSTRUCTIONS);
  assertEquals(knobs.scoutInstructions, SCOUT_INSTRUCTIONS);
  assertEquals(knobs.imageAnalysisPrompt, "describe the room");
});

Deno.test("the Scout's message is the console's builder over the saved place", () => {
  const saved = {
    name: "Contramar",
    google_name: "Contramar Roma",
    address: "Durango 200, Roma Nte., CDMX",
    category: "seafood_restaurant",
    category_label: "Seafood Restaurant",
  };
  assertEquals(
    scoutInputFor(saved),
    buildScoutInput({
      name: "Contramar",
      locationLine: "Durango 200, Roma Nte., CDMX",
      category: "Seafood Restaurant",
    }),
  );
});

Deno.test("the Scout's message falls back to the Google name and drops an undefined category", () => {
  assertEquals(
    scoutInputFor({ name: null, google_name: "Bar X", address: "", category: "undefined" }),
    buildScoutInput({ name: "Bar X", locationLine: "", category: null }),
  );
  assertEquals(scoutInputFor({ name: "", google_name: "" }), null);
});

Deno.test("a list starts enrich multiple places", () => {
  assertEquals(enrichmentRun([ONE, TWO]), {
    task: "mesita-monorepo/enrich-multiple-places",
    input: [[ONE, TWO]],
  });
});

Deno.test("a refused start turns enriching off: ready when enriched before, failed when never", () => {
  assertEquals(contentStateAfterRefusal({ content_state: "generating", enriched_at: "2026-10-01T00:00:00Z" }), "ready");
  assertEquals(contentStateAfterRefusal({ content_state: "generating", enriched_at: null }), "failed");
  assertEquals(contentStateAfterRefusal({ content_state: "ready", enriched_at: null }), null);
});

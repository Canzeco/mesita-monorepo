import { assertEquals } from "jsr:@std/assert@1";
import { ENRICHING_PATCH, enrichmentRun, renderApiKey } from "./start-enrichment.ts";

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

Deno.test("a list starts enrich multiple places", () => {
  assertEquals(enrichmentRun([ONE, TWO]), {
    task: "mesita-monorepo/enrich-multiple-places",
    input: [[ONE, TWO]],
  });
});

import { assertEquals } from "jsr:@std/assert@1";
import { enrichmentRun } from "./start-enrichment.ts";

const ONE = { placeId: "place-1", googlePlaceId: "ChIJ-1" };
const TWO = { placeId: "place-2", googlePlaceId: "ChIJ-2" };

Deno.test("one place starts enrichSingle with its Google id", () => {
  assertEquals(enrichmentRun([ONE]), {
    task: "mesita-monorepo/enrichSingle",
    input: [ONE],
  });
});

Deno.test("a list starts one enrichMultiple", () => {
  assertEquals(enrichmentRun([ONE, TWO]), {
    task: "mesita-monorepo/enrichMultiple",
    input: [[ONE, TWO]],
  });
});

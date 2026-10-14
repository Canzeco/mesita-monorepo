import { assertEquals } from "jsr:@std/assert@1";
import { enrichmentRun } from "./start-enrichment.ts";

Deno.test("one place starts enrichSingle", () => {
  assertEquals(enrichmentRun(["place-1"]), {
    task: "mesita-monorepo/enrichSingle",
    input: ["place-1"],
  });
});

Deno.test("a list starts one enrichMultiple", () => {
  assertEquals(enrichmentRun(["place-1", "place-2"]), {
    task: "mesita-monorepo/enrichMultiple",
    input: [["place-1", "place-2"]],
  });
});

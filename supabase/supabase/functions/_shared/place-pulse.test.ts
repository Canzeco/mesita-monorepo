import { assertEquals } from "jsr:@std/assert@1";
import { isPlaceListed, isPlaceSeeded, placeEnrichLevel } from "./place-pulse.ts";

Deno.test("seeded: a blank or missing google_place_id is not seeded", () => {
  assertEquals(isPlaceSeeded(null), false);
  assertEquals(isPlaceSeeded("   "), false);
  assertEquals(isPlaceSeeded("ChIJN1t_tDeuEmsRUsoyG83frY4"), true);
});

Deno.test("listed: only active and lead are reachable by a guest", () => {
  assertEquals(isPlaceListed("active"), true);
  assertEquals(isPlaceListed("lead"), true);
  for (const s of ["paused", "archived", "pending_review", "pending_verification", null]) {
    assertEquals(isPlaceListed(s), false);
  }
});

Deno.test("enrich level: a queued project is level 0 whatever the row says", () => {
  assertEquals(placeEnrichLevel({ stage: "done", gathered: true, analysis: true }, "queued"), 0);
});

Deno.test("enrich level: no research row is level 0", () => {
  assertEquals(placeEnrichLevel(null, "ready"), 0);
  assertEquals(placeEnrichLevel(undefined, "ready"), 0);
});

Deno.test("enrich level: payload presence, not stage, carries a failed run", () => {
  assertEquals(placeEnrichLevel({ stage: "failed", gathered: true, analysis: false }, "failed"), 1);
  assertEquals(placeEnrichLevel({ stage: "failed", gathered: true, analysis: true }, "failed"), 2);
});

Deno.test("enrich level: done is 3", () => {
  assertEquals(placeEnrichLevel({ stage: "done", gathered: true, analysis: true }, "ready"), 3);
});

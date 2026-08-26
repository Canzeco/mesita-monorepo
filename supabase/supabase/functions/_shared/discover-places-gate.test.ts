import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

// Named Place IDs on Google Search used to skip the Search floor
// (MESITA-1348). MESITA-1359: each ID is judged with Discovery › Map
// after Place Details; one miss is that slot's error, never a batch abort.

Deno.test("discover-places named IDs run evaluatePlaceForMap", async () => {
  const src = await Deno.readTextFile(
    new URL("../supabase-edgefunc-discover-places/index.ts", import.meta.url),
  );
  assertEquals(src.includes("They skip quality filters"), false);
  assertStringIncludes(src, "evaluatePlaceForMap(map");
  assertStringIncludes(src, "error: verdict.eligible ? null : verdict.reason");
});

Deno.test("createMinimalPlace gates every caller on Discovery Map", async () => {
  const src = await Deno.readTextFile(new URL("./create-place.ts", import.meta.url));
  assertEquals(src.includes("admin/business callers pass nothing"), false);
  assertEquals(src.includes("sourcingChannel"), false);
  assertStringIncludes(src, "evaluatePlaceForMap");
  assertStringIncludes(src, "One ID, one 422");
});

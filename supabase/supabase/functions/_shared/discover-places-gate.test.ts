import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

// Named Place IDs on Google Search used to skip Intake › Sourcing
// (MESITA-1348). MESITA-1358: each ID is judged with admin_search after
// Place Details; one miss is that slot's error, never a batch abort.

Deno.test("discover-places named IDs run evaluatePlaceForChannel", async () => {
  const src = await Deno.readTextFile(
    new URL("../supabase-edgefunc-discover-places/index.ts", import.meta.url),
  );
  assertEquals(src.includes("They skip quality filters"), false);
  assertStringIncludes(src, "evaluatePlaceForChannel(adminSearchPolicy");
  assertStringIncludes(src, "error: verdict.eligible ? null : verdict.reason");
});

Deno.test("createMinimalPlace comment matches gated admin/business callers", async () => {
  const src = await Deno.readTextFile(new URL("./create-place.ts", import.meta.url));
  assertEquals(src.includes("admin/business callers pass nothing"), false);
  assertStringIncludes(src, "admin_add");
  assertStringIncludes(src, "One ID, one 422");
});

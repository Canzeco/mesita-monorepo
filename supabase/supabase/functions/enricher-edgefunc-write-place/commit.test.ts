import { assertEquals } from "jsr:@std/assert@1";
import { enrichmentCommit } from "./commit.ts";

Deno.test("a finished place is accepted", () => {
  const got = enrichmentCommit({
    placeId: "place-1",
    patch: { content_state: "ready", phone: "+52 55 0000 0000" },
  });
  assertEquals(got.ok, true);
  if (got.ok) {
    assertEquals(got.placeId, "place-1");
    assertEquals(got.patch.content_state, "ready");
  }
});

Deno.test("anything short of a finished profile writes nothing", () => {
  assertEquals(
    enrichmentCommit({ placeId: "place-1", patch: { content_state: "generating", phone: "x" } }).ok,
    false,
  );
  assertEquals(enrichmentCommit({ placeId: "place-1", patch: { phone: "x" } }).ok, false);
  assertEquals(enrichmentCommit({ placeId: "place-1", patch: { content_state: "ready" } }).ok, false);
  assertEquals(enrichmentCommit({ placeId: "  ", patch: { content_state: "ready", phone: "x" } }).ok, false);
  assertEquals(enrichmentCommit(null).ok, false);
});

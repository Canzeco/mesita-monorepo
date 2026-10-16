import { assertEquals } from "jsr:@std/assert@1";
import { enrichmentCommit, enrichmentConflicts } from "./commit.ts";

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

Deno.test("mirror stays on unless the body turns it off", () => {
  const on = enrichmentCommit({
    placeId: "place-1",
    patch: { content_state: "ready", phone: "x" },
  });
  const off = enrichmentCommit({
    placeId: "place-1",
    patch: { content_state: "ready", phone: "x" },
    mirrorPhotos: false,
  });
  assertEquals(on.ok && on.mirrorPhotos, true);
  assertEquals(off.ok && off.mirrorPhotos, false);
});

Deno.test("a newer profile conflicts and an unchanged one does not", () => {
  assertEquals(enrichmentConflicts("2026-10-16T01:00:00Z", "2026-10-16T00:00:00Z"), true);
  assertEquals(enrichmentConflicts("2026-10-16T00:00:00Z", "2026-10-16T00:00:00Z"), false);
  assertEquals(enrichmentConflicts(null, "2026-10-16T00:00:00Z"), true);
  assertEquals(enrichmentConflicts("2026-10-16T00:00:00Z", null), false);
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

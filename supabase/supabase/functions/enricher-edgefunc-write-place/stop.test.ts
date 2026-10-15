import { assertEquals } from "jsr:@std/assert@1";
import { contentStateAfterStop, enrichmentStop } from "./stop.ts";

Deno.test("a stop is place id only", () => {
  assertEquals(enrichmentStop({ placeId: " place-1 ", stop: true }), {
    kind: "stop",
    placeId: "place-1",
  });
  assertEquals(enrichmentStop({ placeId: "place-1", patch: { content_state: "ready", phone: "x" } }), {
    kind: "not-stop",
  });
  assertEquals(enrichmentStop({ placeId: "place-1", stop: true, patch: {} }).kind, "invalid");
  assertEquals(enrichmentStop({ stop: true }).kind, "invalid");
  assertEquals(enrichmentStop(null).kind, "not-stop");
});

Deno.test("a stop turns enriching off and leaves a finished write alone", () => {
  assertEquals(
    contentStateAfterStop({ content_state: "generating", enriched_at: null }),
    "failed",
  );
  assertEquals(
    contentStateAfterStop({ content_state: "generating", enriched_at: "2026-10-01T00:00:00Z" }),
    "ready",
  );
  assertEquals(
    contentStateAfterStop({ content_state: "ready", enriched_at: "2026-10-01T00:00:00Z" }),
    null,
  );
  assertEquals(
    contentStateAfterStop({ content_state: "failed", enriched_at: null }),
    null,
  );
});

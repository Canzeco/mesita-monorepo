// MESITA-4678: a signed-out open counts as a view and as an anonymous view,
// and never as a guest.
import { assertEquals } from "jsr:@std/assert@1";
import { synthesizeViews } from "./analytics.ts";

Deno.test("synthesizeViews counts signed-out opens as views, never as guests", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  const a = synthesizeViews(
    [
      { consumer_id: null, kind: "viewed", created_at: "2026-11-22T10:00:00Z" },
      { consumer_id: null, kind: "viewed", created_at: "2026-11-01T10:00:00Z" },
      { consumer_id: "g1", kind: "viewed", created_at: "2026-11-21T10:00:00Z" },
      { consumer_id: "g1", kind: "viewed", created_at: "2026-11-22T09:00:00Z" },
    ],
    now,
  );
  assertEquals(a.views, 4);
  assertEquals(a.anonymous, 2);
  assertEquals(a.viewers, 1);
  assertEquals(a.returning, 1);
  assertEquals(a.views7d, 3);
  assertEquals(a.viewers30d, 1);
});

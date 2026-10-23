import { assertEquals } from "jsr:@std/assert@1";
import {
  mergeActivityFeed,
  summarizeOperatorVerbs,
  type AdminOperatorEventRow,
} from "./admin-operator-events.ts";

Deno.test("summarizeOperatorVerbs groups by verb and outcome", () => {
  const rows: AdminOperatorEventRow[] = [
    {
      id: 1,
      verb: "create",
      outcome: "succeeded",
      place_id: "a",
      source: "admin-web-create-place",
      detail: {},
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: 2,
      verb: "enrich",
      outcome: "succeeded",
      place_id: null,
      source: "admin-web-enrich-place",
      detail: { count: 3 },
      created_at: "2026-10-02T00:00:00Z",
    },
    {
      id: 3,
      verb: "create",
      outcome: "failed",
      place_id: null,
      source: "admin-web-create-place",
      detail: { code: "quota" },
      created_at: "2026-10-03T00:00:00Z",
    },
  ];
  assertEquals(summarizeOperatorVerbs(rows), {
    create: { succeeded: 1, failed: 1 },
    update: { succeeded: 0, failed: 0 },
    enrich: { succeeded: 1, failed: 0 },
    edit: { succeeded: 0, failed: 0 },
  });
});

Deno.test("mergeActivityFeed sorts newest first and caps", () => {
  const feed = mergeActivityFeed(
    [{
      id: 1,
      created_at: "2026-10-01T12:00:00Z",
      outcome: "created",
      google_place_id: "ChIJabcdefghij",
      place_id: "11111111-1111-1111-1111-111111111111",
    }],
    [{
      id: 9,
      verb: "update",
      outcome: "succeeded",
      place_id: "22222222-2222-2222-2222-222222222222",
      source: "admin-web-update-place-google",
      detail: {},
      created_at: "2026-10-02T12:00:00Z",
    }],
    10,
  );
  assertEquals(feed.length, 2);
  assertEquals(feed[0]?.id, "op-9");
});

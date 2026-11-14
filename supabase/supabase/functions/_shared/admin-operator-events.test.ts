import { assertEquals } from "jsr:@std/assert@1";
import {
  mergeActivityFeed,
} from "./admin-operator-events.ts";

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

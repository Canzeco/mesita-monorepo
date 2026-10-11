import { assertEquals } from "jsr:@std/assert@1";
import {
  isPlaceEnriched,
  isPlaceEnriching,
  isPlaceListed,
  isPlaceProfileReady,
  isPlaceRequested,
  isPlaceSeeded,
} from "./place-state.ts";

Deno.test("seeded: a blank or missing google_place_id is not seeded", () => {
  assertEquals(isPlaceSeeded(null), false);
  assertEquals(isPlaceSeeded("   "), false);
  assertEquals(isPlaceSeeded("ChIJN1t_tDeuEmsRUsoyG83frY4"), true);
});

Deno.test("listed: only active is reachable by a guest", () => {
  assertEquals(isPlaceListed("active"), true);
  // `lead` is a dead label (MESITA-2144): still on the enum, never listed.
  for (const s of ["paused", "archived", "lead", null]) {
    assertEquals(isPlaceListed(s), false);
  }
});

Deno.test("listed: a missing or non-string state is never listed", () => {
  // The search EF degrades a failed read to the safe direction for a state
  // column. Claiming a place is guest-visible when we do not know is the one
  // direction that misleads.
  for (const bad of [null, undefined, "", 0, {}, []]) {
    assertEquals(isPlaceListed(bad), false, `${JSON.stringify(bad)}`);
  }
});

Deno.test("requested: count > 0 and not ready; Enriched wins", () => {
  assertEquals(
    isPlaceRequested({ requestCount: 1, contentState: "generating" }),
    true,
  );
  assertEquals(
    isPlaceRequested({ requestCount: 2, contentState: "failed" }),
    true,
  );
  assertEquals(
    isPlaceRequested({ requestCount: 0, contentState: "generating" }),
    false,
  );
  assertEquals(
    isPlaceRequested({ requestCount: 7, contentState: "ready" }),
    false,
  );
  assertEquals(
    isPlaceRequested({ requestCount: null, contentState: "generating" }),
    false,
  );
  assertEquals(isPlaceRequested({}), false);
});

Deno.test("enriching: only generating is mid-flight", () => {
  assertEquals(isPlaceEnriching("generating"), true);
  assertEquals(isPlaceEnriching("ready"), false);
  assertEquals(isPlaceEnriching("failed"), false);
  assertEquals(isPlaceEnriching(null), false);
});

Deno.test("enriched: a stamp on places.enriched_at, never content_state", () => {
  assertEquals(isPlaceEnriched("2026-08-28T00:00:00Z"), true);
  assertEquals(isPlaceEnriched(null), false);
  assertEquals(isPlaceEnriched(""), false);
  assertEquals(isPlaceEnriched("   "), false);
  assertEquals(
    isPlaceRequested({
      requestCount: 2,
      contentState: "ready",
      enrichedAt: null,
    }),
    true,
    "ugly Create profile can still collect votes",
  );
  assertEquals(
    isPlaceRequested({
      requestCount: 2,
      contentState: "ready",
      enrichedAt: "2026-08-28T00:00:00Z",
    }),
    false,
  );
});

Deno.test("profile ready: only content_state ready is a usable profile", () => {
  assertEquals(isPlaceProfileReady("ready"), true);
  assertEquals(isPlaceProfileReady("generating"), false);
  assertEquals(isPlaceProfileReady("failed"), false);
  assertEquals(isPlaceProfileReady(null), false);
});

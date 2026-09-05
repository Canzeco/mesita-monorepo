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

Deno.test("listed: only active and lead are reachable by a guest", () => {
  assertEquals(isPlaceListed("active"), true);
  assertEquals(isPlaceListed("lead"), true);
  for (const s of ["paused", "archived", "pending_review", "pending_verification", null]) {
    assertEquals(isPlaceListed(s), false);
  }
});

// The states that are NOT reachable. The list above is only half the
// contract: project_state also carries paused, archived, pending_review and
// pending_verification, and every one of them must read as not-listed. Pinning
// them by name means a new state added to the enum shows up here as a
// deliberate choice rather than defaulting into visibility.
Deno.test("listed: every other project_state is unreachable", () => {
  for (
    const state of [
      "paused",
      "archived",
      "pending_review",
      "pending_verification",
    ]
  ) {
    assertEquals(isPlaceListed(state), false, `${state} must not be listed`);
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
    isPlaceRequested({ requestCount: 1, contentState: "queued" }),
    true,
  );
  assertEquals(
    isPlaceRequested({ requestCount: 2, contentState: "failed" }),
    true,
  );
  assertEquals(
    isPlaceRequested({ requestCount: 0, contentState: "queued" }),
    false,
  );
  assertEquals(
    isPlaceRequested({ requestCount: 7, contentState: "ready" }),
    false,
  );
  assertEquals(
    isPlaceRequested({ requestCount: null, contentState: "queued" }),
    false,
  );
  assertEquals(isPlaceRequested({}), false);
});

Deno.test("enriching: generating or queued is mid-flight", () => {
  assertEquals(isPlaceEnriching("generating"), true);
  assertEquals(isPlaceEnriching("queued"), true);
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
  assertEquals(isPlaceProfileReady("queued"), false);
  assertEquals(isPlaceProfileReady("generating"), false);
  assertEquals(isPlaceProfileReady("failed"), false);
  assertEquals(isPlaceProfileReady(null), false);
});

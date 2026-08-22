import { assertEquals } from "jsr:@std/assert@1";
import {
  isPlaceListed,
  isPlaceSeeded,
  placeEnrichLevel,
} from "./place-status.ts";

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

Deno.test("enrich level: a queued project is level 0 whatever the row says", () => {
  assertEquals(placeEnrichLevel({ stage: "done", gathered: true, analysis: true }, "queued"), 0);
});

Deno.test("enrich level: no research row is level 0", () => {
  assertEquals(placeEnrichLevel(null, "ready"), 0);
  assertEquals(placeEnrichLevel(undefined, "ready"), 0);
});

Deno.test("enrich level: payload presence, not stage, carries a failed run", () => {
  assertEquals(placeEnrichLevel({ stage: "failed", gathered: true, analysis: false }, "failed"), 1);
  assertEquals(placeEnrichLevel({ stage: "failed", gathered: true, analysis: true }, "failed"), 2);
});

Deno.test("enrich level: done is 3", () => {
  assertEquals(placeEnrichLevel({ stage: "done", gathered: true, analysis: true }, "ready"), 3);
});

// The statuses that are NOT reachable. The list above is only half the
// contract: project_status also carries paused, archived, pending_review and
// pending_verification, and every one of them must read as not-listed. Pinning
// them by name means a new status added to the enum shows up here as a
// deliberate choice rather than defaulting into visibility.
Deno.test("listed: every other project_status is unreachable", () => {
  for (
    const status of [
      "paused",
      "archived",
      "pending_review",
      "pending_verification",
    ]
  ) {
    assertEquals(isPlaceListed(status), false, `${status} must not be listed`);
  }
});

Deno.test("listed: a missing or non-string status is never listed", () => {
  // The search EF degrades a failed read to the safe direction for a status
  // column. Claiming a place is guest-visible when we do not know is the one
  // direction that misleads.
  for (const bad of [null, undefined, "", 0, {}, []]) {
    assertEquals(isPlaceListed(bad), false, `${JSON.stringify(bad)}`);
  }
});

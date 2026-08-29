import { assertEquals } from "jsr:@std/assert@1";
import {
  isPlaceEnriching,
  isPlaceListed,
  isPlaceRequested,
  isPlaceSeeded,
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

Deno.test("requested: pending_review and pending_verification only", () => {
  assertEquals(isPlaceRequested("pending_review"), true);
  assertEquals(isPlaceRequested("pending_verification"), true);
  assertEquals(isPlaceRequested("lead"), false);
  assertEquals(isPlaceRequested("active"), false);
  assertEquals(isPlaceRequested(null), false);
});

Deno.test("enriching: generating or queued is mid-flight", () => {
  assertEquals(isPlaceEnriching("generating"), true);
  assertEquals(isPlaceEnriching("queued"), true);
  assertEquals(isPlaceEnriching("ready"), false);
  assertEquals(isPlaceEnriching("failed"), false);
  assertEquals(isPlaceEnriching(null), false);
});

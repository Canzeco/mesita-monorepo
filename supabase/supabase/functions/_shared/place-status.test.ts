import { assertEquals } from "jsr:@std/assert@1";
import {
  isPlaceListed,
  isPlaceSeeded,
  placeEnrichLevel,
  placeEnrichProgress,
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

// ── placeEnrichProgress (MESITA-1200) ──────────────────────────────────────

Deno.test("progress: no subprocess events at all is null, not 0/0", () => {
  // The caller falls back to the coarse 0-3 level. Returning {done:0,total:0}
  // would render an empty meter on a place that may be fully enriched by an
  // older run that never reported subprocesses.
  assertEquals(placeEnrichProgress([]), null);
});

Deno.test("progress: legacy stage rows are not subprocesses", () => {
  // Rows written before per-subprocess reporting carry stage labels. They must
  // not be counted, and must not be mistaken for "has events".
  assertEquals(
    placeEnrichProgress([
      { step_name: "gather", status: "completed", created_at: "2026-08-22T03:05:08Z" },
      { step_name: "publish", status: "completed", created_at: "2026-08-22T03:05:54Z" },
    ]),
    null,
  );
});

Deno.test("progress: skipped leaves the denominator entirely", () => {
  // The whole point of the third state. A place that never buys social must
  // still be able to read as fully enriched.
  assertEquals(
    placeEnrichProgress([
      { step_name: "google", status: "completed", created_at: "2026-08-22T03:00:00Z" },
      { step_name: "reviews", status: "completed", created_at: "2026-08-22T03:00:01Z" },
      { step_name: "social", status: "skipped", created_at: "2026-08-22T03:00:02Z" },
    ]),
    { done: 2, total: 2 },
  );
});

Deno.test("progress: failed counts against the place, unlike skipped", () => {
  assertEquals(
    placeEnrichProgress([
      { step_name: "google", status: "completed", created_at: "2026-08-22T03:00:00Z" },
      { step_name: "reviews", status: "failed", created_at: "2026-08-22T03:00:01Z" },
    ]),
    { done: 1, total: 2 },
  );
});

Deno.test("progress: a re-enrich counts the LATEST event, never both", () => {
  // The log is append-only. Counting rows would report done > total here.
  assertEquals(
    placeEnrichProgress([
      { step_name: "google", status: "completed", created_at: "2026-08-22T03:00:00Z" },
      { step_name: "reviews", status: "failed", created_at: "2026-08-22T03:00:00Z" },
      { step_name: "reviews", status: "completed", created_at: "2026-08-22T09:00:00Z" },
    ]),
    { done: 2, total: 2 },
  );
});

Deno.test("progress: a later run that SKIPS a previously-done subprocess drops it", () => {
  // Honest, and worth pinning: a cheap refresh that does not buy reviews leaves
  // the place with reviews it already had, but the meter now describes THIS
  // place's current bought set. done never exceeds total either way.
  const p = placeEnrichProgress([
    { step_name: "google", status: "completed", created_at: "2026-08-22T03:00:00Z" },
    { step_name: "reviews", status: "completed", created_at: "2026-08-22T03:00:00Z" },
    { step_name: "reviews", status: "skipped", created_at: "2026-08-22T09:00:00Z" },
  ]);
  // reviews left the denominator; only google remains bought.
  assertEquals(p, { done: 1, total: 1 });
});

Deno.test("progress: done never exceeds total", () => {
  const p = placeEnrichProgress([
    { step_name: "google", status: "completed", created_at: "2026-08-22T03:00:00Z" },
    { step_name: "google", status: "completed", created_at: "2026-08-22T04:00:00Z" },
    { step_name: "serp", status: "completed", created_at: "2026-08-22T03:00:00Z" },
  ]);
  assertEquals(p, { done: 2, total: 2 });
});

Deno.test("progress: unknown or missing fields never crash the fold", () => {
  assertEquals(
    placeEnrichProgress([
      { step_name: "google", status: "completed", created_at: "2026-08-22T03:00:00Z" },
      { step_name: null, status: "completed", created_at: null },
      { step_name: "wizard", status: "completed", created_at: "2026-08-22T03:00:00Z" },
      { step_name: "links", status: null, created_at: "2026-08-22T03:00:00Z" },
    ]),
    // links has an unrecognised status: bought, not completed → counts against.
    { done: 1, total: 2 },
  );
});

Deno.test("progress: legacy events that happen to use a subprocess key still fold to null", () => {
  // The exact live state of the one enriched place in production before this
  // shipped: three stage beacons, of which `images` collides with a real
  // subprocess key. Without the `google` sentinel this returns {done:1,total:1}
  // and the row claims to be fully enriched off one legacy beacon.
  assertEquals(
    placeEnrichProgress([
      { step_name: "gather", status: "completed", created_at: "2026-08-22T03:05:08Z" },
      { step_name: "images", status: "completed", created_at: "2026-08-22T03:05:28Z" },
      { step_name: "publish", status: "completed", created_at: "2026-08-22T03:05:54Z" },
    ]),
    null,
  );
});

Deno.test("progress: once google reports, the fold is trusted", () => {
  assertEquals(
    placeEnrichProgress([
      { step_name: "google", status: "completed", created_at: "2026-08-22T10:00:00Z" },
      { step_name: "images", status: "completed", created_at: "2026-08-22T10:00:01Z" },
      { step_name: "social", status: "skipped", created_at: "2026-08-22T10:00:02Z" },
    ]),
    { done: 2, total: 2 },
  );
});

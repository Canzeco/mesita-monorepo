import { assertEquals } from "jsr:@std/assert@1";
import { normalizeOjoConfig, OJO_DEFAULTS, type OjoConfig } from "./ojo-config.ts";

// THE SHIP GATE for the admin-console knob reduction (Pato, 2026-08-21:
// "less info, that's overwhelming, just ask the important params").
//
// The reduction removes CONTROLS, never KEYS. Every one of these pages saves
// the WHOLE blob, so if a key stops being rendered AND stops being carried,
// the first Save after the reduction silently writes a blob without it — and
// the engine that ships later reads a default over the operator's real value.
//
// Two properties have to hold for that to be safe, and every config page in
// the reduction needs this pair of tests before its controls come off:
//
//   1. The normalizer MERGES over defaults — an absent key comes back at its
//      default rather than undefined.
//   2. A stored value for a key with NO control round-trips untouched.
//
// Ojo is the template page: showGuestReason and maxRetries lost their
// controls, so they are exactly the keys these tests are here to protect.

/** The keys whose control the minimal page removed. */
const UNRENDERED = ["showGuestReason", "maxRetries"] as const;

Deno.test("normalizeOjoConfig: an absent key comes back at its default", () => {
  const stripped = { ...OJO_DEFAULTS } as Record<string, unknown>;
  for (const k of UNRENDERED) delete stripped[k];

  assertEquals(normalizeOjoConfig(stripped), OJO_DEFAULTS);
});

Deno.test("normalizeOjoConfig: a stored value with no control survives", () => {
  // An operator set these before the controls came off. The engine must still
  // see THEIR values on the day it ships, not the defaults.
  const stored: OjoConfig = {
    ...OJO_DEFAULTS,
    showGuestReason: false,
    maxRetries: 7,
  };

  const out = normalizeOjoConfig(stored);
  assertEquals(out.showGuestReason, false);
  assertEquals(out.maxRetries, 7);
  // And the whole blob is unchanged, not just those two.
  assertEquals(out, stored);
});

Deno.test("normalizeOjoConfig: an empty blob is the full default set", () => {
  // The seeded-from-nothing case: every key present, nothing undefined.
  const out = normalizeOjoConfig({}) as unknown as Record<string, unknown>;
  for (const key of Object.keys(OJO_DEFAULTS)) {
    assertEquals(key in out, true, `${key} must survive an empty read`);
  }
  assertEquals(out, OJO_DEFAULTS as unknown as Record<string, unknown>);
});

Deno.test("normalizeOjoConfig: the review floor still clamps to auto-pass", () => {
  // The one invariant the page's save relies on, and the floor lives behind
  // the disclosure now — so it is even more important that the server holds
  // the line rather than the form.
  const out = normalizeOjoConfig({
    ...OJO_DEFAULTS,
    autoPassScore: 0.5,
    reviewFloorScore: 0.9,
  });
  assertEquals(out.reviewFloorScore, 0.5);
});

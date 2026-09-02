import { assertEquals } from "jsr:@std/assert@1";
import {
  CONTROLS_DEFAULTS,
  type ControlsConfig,
  guestControlsPolicy,
  normalizeControlsConfig,
  resolveHoldHours,
} from "./controls-config.ts";

// The key the admin Controls page does not render. Whole-blob save must still
// carry it so a later reader sees the operator's stored value, not a default.
const UNRENDERED = ["minHoldHours"] as const;

Deno.test("normalizeControlsConfig: an absent key comes back at its default", () => {
  const stripped = { ...CONTROLS_DEFAULTS } as Record<string, unknown>;
  for (const k of UNRENDERED) delete stripped[k];
  assertEquals(normalizeControlsConfig(stripped), CONTROLS_DEFAULTS);
});

Deno.test("normalizeControlsConfig: a stored unrendered value survives", () => {
  const stored: ControlsConfig = { ...CONTROLS_DEFAULTS, minHoldHours: 2 };
  assertEquals(normalizeControlsConfig(stored), stored);
});

Deno.test("normalizeControlsConfig: the shipped default is three hours", () => {
  assertEquals(normalizeControlsConfig({}).defaultHoldHours, 3);
});

Deno.test("normalizeControlsConfig: garbage falls back rather than throwing", () => {
  assertEquals(normalizeControlsConfig(null), CONTROLS_DEFAULTS);
  assertEquals(normalizeControlsConfig("nope"), CONTROLS_DEFAULTS);
  assertEquals(
    normalizeControlsConfig({ defaultHoldHours: "abc" }).defaultHoldHours,
    CONTROLS_DEFAULTS.defaultHoldHours,
  );
});

Deno.test("normalizeControlsConfig: the ceiling never sits below the floor", () => {
  const c = normalizeControlsConfig({ minHoldHours: 24, maxHoldHours: 6 });
  assertEquals(c.minHoldHours, 24);
  assertEquals(c.maxHoldHours, 24);
});

Deno.test("normalizeControlsConfig: the default is clamped into the window", () => {
  // An operator who narrows the window must not strand the default outside it.
  const low = normalizeControlsConfig({ defaultHoldHours: 1, minHoldHours: 8 });
  assertEquals(low.defaultHoldHours, 8);
  const high = normalizeControlsConfig({
    defaultHoldHours: 500,
    maxHoldHours: 12,
  });
  assertEquals(high.defaultHoldHours, 12);
});

Deno.test("resolveHoldHours: no place override inherits the default", () => {
  assertEquals(resolveHoldHours(CONTROLS_DEFAULTS, null), 3);
  assertEquals(resolveHoldHours(CONTROLS_DEFAULTS, undefined), 3);
  assertEquals(resolveHoldHours(CONTROLS_DEFAULTS, Number.NaN), 3);
});

Deno.test("resolveHoldHours: a place override wins, clamped to the ceiling", () => {
  assertEquals(resolveHoldHours(CONTROLS_DEFAULTS, 24), 24);
  assertEquals(resolveHoldHours(CONTROLS_DEFAULTS, 999), 72);
});

Deno.test("resolveHoldHours: zero is a real override, not an absent one", () => {
  // Instant-use Credits are a legitimate thing a place may offer, so 0 must
  // not be swallowed as falsy and replaced by the 3h default.
  assertEquals(resolveHoldHours(CONTROLS_DEFAULTS, 0), 0);
});

Deno.test("guestControlsPolicy: the operator's window is not guest-facing", () => {
  assertEquals(guestControlsPolicy(CONTROLS_DEFAULTS), {
    defaultHoldHours: 3,
    defaultBonusPct: 5,
  });
});

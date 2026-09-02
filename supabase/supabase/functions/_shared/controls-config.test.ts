import { assertEquals } from "jsr:@std/assert@1";
import {
  CONTROLS_DEFAULTS,
  type ControlsConfig,
  guestControlsPolicy,
  normalizeControlsConfig,
  resolveExpiryDays,
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
  // The expiry DEFAULT crosses and its FLOOR does not: a guest is owed the date
  // their own Credits die, never the range a venue could have picked from.
  assertEquals(guestControlsPolicy(CONTROLS_DEFAULTS), {
    defaultHoldHours: 3,
    defaultBonusPct: 5,
    defaultExpiryDays: 90,
  });
});

Deno.test("normalizeControlsConfig: the shipped expiry is 90 days, floored at 30", () => {
  const c = normalizeControlsConfig({});
  assertEquals(c.defaultExpiryDays, 90);
  assertEquals(c.minExpiryDays, 30);
});

Deno.test("normalizeControlsConfig: expiry is read in DAYS, not hours", () => {
  // The regression this catches is an operator (or a migration) typing the
  // expiry in the hold's unit. 90 stays 90; it is never rescaled by 24.
  assertEquals(normalizeControlsConfig({ defaultExpiryDays: 90 })
    .defaultExpiryDays, 90);
});

Deno.test("normalizeControlsConfig: the default expiry is floored, never stranded under it", () => {
  const c = normalizeControlsConfig({ defaultExpiryDays: 7, minExpiryDays: 30 });
  assertEquals(c.defaultExpiryDays, 30);
});

Deno.test("normalizeControlsConfig: Credits can never expire before they mature", () => {
  // A 30-day hold ceiling with a 1-day floor would sell money that is locked
  // for its whole life. The floor is raised to cover the longest hold instead.
  const c = normalizeControlsConfig({ maxHoldHours: 720, minExpiryDays: 1 });
  assertEquals(c.minExpiryDays, 30);
  assertEquals(c.defaultExpiryDays, 90);
});

Deno.test("normalizeControlsConfig: a stored expiry survives the round trip", () => {
  const stored: ControlsConfig = {
    ...CONTROLS_DEFAULTS,
    defaultExpiryDays: 180,
    minExpiryDays: 60,
  };
  assertEquals(normalizeControlsConfig(stored), stored);
});

Deno.test("normalizeControlsConfig: a blob written before expiry existed reads at the defaults", () => {
  // Every live row is one of these until the migration lands, and the EF must
  // answer with a policy rather than an undefined.
  const legacy = {
    defaultHoldHours: 3,
    defaultBonusPct: 5,
    maxHoldHours: 72,
    minHoldHours: 0,
  };
  assertEquals(normalizeControlsConfig(legacy), CONTROLS_DEFAULTS);
});

Deno.test("resolveExpiryDays: no place override inherits the default", () => {
  assertEquals(resolveExpiryDays(CONTROLS_DEFAULTS, null), 90);
  assertEquals(resolveExpiryDays(CONTROLS_DEFAULTS, undefined), 90);
  assertEquals(resolveExpiryDays(CONTROLS_DEFAULTS, Number.NaN), 90);
});

Deno.test("resolveExpiryDays: a place may sell a LONGER life, never a shorter one", () => {
  assertEquals(resolveExpiryDays(CONTROLS_DEFAULTS, 365), 365);
  assertEquals(resolveExpiryDays(CONTROLS_DEFAULTS, 7), 30);
});

Deno.test("resolveExpiryDays: zero is not instant-expiry, it floors", () => {
  // resolveHoldHours honours 0 because instant-use Credits are a real product.
  // Money that dies on purchase is not, so the mirror case must NOT mirror.
  assertEquals(resolveExpiryDays(CONTROLS_DEFAULTS, 0), 30);
});

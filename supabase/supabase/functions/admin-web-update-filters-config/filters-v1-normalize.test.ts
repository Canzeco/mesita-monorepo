// Tests for the v1 Filters normalizer (MESITA-1083).
//
// This module is the SAVE-SIDE mirror of web-admin's
// filters-config/filters.ts. The pins below are the same values that file's
// vitest suite asserts — if the two drift, one of the suites goes red rather
// than the console and the stored blob quietly disagreeing about what the
// defaults are.

import { assertEquals } from "jsr:@std/assert@1";
import {
  DEFAULT_FILTERS_V1,
  MODULE_KEYS,
  normalizeFiltersV1,
  SURFACE_KEYS,
} from "./filters-v1-normalize.ts";

Deno.test("normalizeFiltersV1: round-trips the defaults", () => {
  assertEquals(normalizeFiltersV1(DEFAULT_FILTERS_V1), DEFAULT_FILTERS_V1);
});

Deno.test("normalizeFiltersV1: garbage still yields a COMPLETE blob", () => {
  for (const bad of [null, undefined, [], "nope", 7, {}]) {
    const cfg = normalizeFiltersV1(bad);
    assertEquals(cfg.version, 1);
    assertEquals(Object.keys(cfg.surfaces).sort(), [...SURFACE_KEYS].sort());
    for (const key of SURFACE_KEYS) {
      assertEquals(
        Object.keys(cfg.surfaces[key].modules).sort(),
        [...MODULE_KEYS].sort(),
      );
    }
  }
});

Deno.test("normalizeFiltersV1: defaults mirror the shipped consumer engine", () => {
  const { defaults, bounds, behavior } = DEFAULT_FILTERS_V1.general;
  assertEquals(defaults.context, "any");
  assertEquals(defaults.when, "anytime");
  assertEquals(defaults.maxKm, null);
  assertEquals(defaults.randomness, 0);
  assertEquals(bounds.distanceMinKm, 1);
  assertEquals(bounds.distanceMaxKm, 50);
  assertEquals(bounds.randomnessMax, 4);
  assertEquals(bounds.categoryOptionsCap, 12);
  assertEquals(behavior.sharedStore, true);
  assertEquals(behavior.persistSession, true);
  assertEquals(behavior.zoneSeedsRadius, true);
});

Deno.test("normalizeFiltersV1: live surfaces on, parked Home modes off", () => {
  const s = DEFAULT_FILTERS_V1.surfaces;
  assertEquals(s.swipe.enabled, true);
  assertEquals(s.map.enabled, true);
  assertEquals(s.search.enabled, true);
  assertEquals(s.catalog.enabled, false);
  assertEquals(s.chat.enabled, false);
  assertEquals(s.social.enabled, false);
});

Deno.test("normalizeFiltersV1: a partial body keeps its edits and fills the rest", () => {
  const cfg = normalizeFiltersV1({
    general: { modules: { random: false }, defaults: { context: "visit" } },
    surfaces: { map: { overrides: { maxKm: "any" } } },
  });
  assertEquals(cfg.general.modules.random, false);
  assertEquals(cfg.general.modules.where, true);
  assertEquals(cfg.general.defaults.context, "visit");
  assertEquals(cfg.general.defaults.when, "anytime");
  assertEquals(cfg.surfaces.map.overrides.maxKm, "any");
  assertEquals(cfg.surfaces.swipe.overrides.maxKm, null);
});

Deno.test("normalizeFiltersV1: clamps rather than rejects", () => {
  const cfg = normalizeFiltersV1({
    general: {
      defaults: { randomness: 99, maxKm: 100000 },
      bounds: { categoryOptionsCap: 0, randomnessMax: -5 },
    },
    surfaces: { swipe: { resultCap: 99999 } },
  });
  assertEquals(cfg.general.defaults.randomness, 4);
  assertEquals(cfg.general.defaults.maxKm, 200);
  assertEquals(cfg.general.bounds.categoryOptionsCap, 1);
  assertEquals(cfg.general.bounds.randomnessMax, 0);
  assertEquals(cfg.surfaces.swipe.resultCap, 500);
});

Deno.test("normalizeFiltersV1: null maxKm stays `Any`", () => {
  const cfg = normalizeFiltersV1({ general: { defaults: { maxKm: null } } });
  assertEquals(cfg.general.defaults.maxKm, null);
});

Deno.test("normalizeFiltersV1: drops unknown surfaces, modules and enum values", () => {
  const cfg = normalizeFiltersV1({
    surfaces: {
      nonsense: { enabled: true },
      swipe: {
        modules: { context: "maybe", nonsense: "on" },
        // `order` is parked and can never be a stored default.
        overrides: { context: "order", when: "later" },
      },
    },
  });
  assertEquals("nonsense" in cfg.surfaces, false);
  assertEquals("nonsense" in cfg.surfaces.swipe.modules, false);
  assertEquals(cfg.surfaces.swipe.modules.context, "inherit");
  assertEquals(cfg.surfaces.swipe.overrides.context, "any");
  assertEquals(cfg.surfaces.swipe.overrides.when, "anytime");
});

Deno.test("normalizeFiltersV1: does not mutate its input", () => {
  const raw = { general: { modules: { random: false } } };
  const before = JSON.stringify(raw);
  normalizeFiltersV1(raw);
  assertEquals(JSON.stringify(raw), before);
});

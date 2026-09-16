// MESITA-1410 — money may not buy the whole deck, carried to MESITA-1858.
//
// At decision time the money axis was one signal, `mesita_level`, and it was
// entirely bought: `plan` is money and `promoting` is only true if the place
// pays. It floored at LEVEL_LISTED = 0.04, so the promoting-over-listed ratio
// was 25^w and Pato capped the exponent at 2 (a 625x span) rather than let an
// operator reach the uniform 4 (390,625x), where money stops being a signal
// and becomes a sort key.
//
// MESITA-1858 SPLIT THAT AXIS IN TWO and the cap had to be carried BY NAME.
// This map is keyed on the literal signal key: had `mesita_level` simply left
// it, `partnered` would have inherited the general ceiling of 4 and money's
// exponent ceiling would have DOUBLED on merge day, with nothing failing.
//
// AND THE TEST THAT GUARDED IT WOULD HAVE GONE VACUOUS, NOT RED. The mirror
// test below used to iterate `Object.entries(SIGNAL_WEIGHT_MAX)` — empty the
// map and the loop body never runs and the test passes green with zero
// coverage. It now asserts the map is NON-EMPTY and pins `partnered` by name,
// in both packages.
//
// The arithmetic moved under the 2: `partnered` floors at PARTNERED_OFF = 0.2,
// so its span is 5^w — 25x at the ceiling, 625x at the uniform max. These
// tests pin the ceiling, not the reasoning; the numbers are written by hand
// here on purpose, never derived from the function under test.

import {
  assert,
  assertEquals,
  assertNotEquals,
} from "jsr:@std/assert@1";
import {
  DEFAULT_SIGNAL_PARAMS,
  DISCOVERY_DEFAULTS,
  normalizeDiscoveryConfig,
  resetLegacySignalWarnings,
  SIGNAL_PARAM_BOUNDS,
  SIGNAL_WEIGHT_MAX,
  WEIGHT_MAX,
  weightMaxFor,
} from "./discovery-config.ts";
import {
  ENRICHED_OFF,
  PARTNERED_OFF,
  SIGNAL_BLURBS,
  SIGNAL_KEYS,
  SIGNAL_LABELS,
  SIGNALS,
} from "./discovery-signals.ts";
import {
  WEIGHTED_MODE_KEYS,
  weightsForMode,
} from "./discovery-matrix.ts";

const CATALOG_SRC = Deno.readTextFileSync(
  new URL(
    "../../../../apps/web-admin/src/app/(app)/filters-config/catalog.ts",
    import.meta.url,
  ),
);

Deno.test("the per-signal ceiling map is NOT empty — the vacuity guard", () => {
  // The whole point. An empty map makes every ceiling the uniform 4, and the
  // old loop-only mirror test would still have passed.
  assert(
    Object.keys(SIGNAL_WEIGHT_MAX).length > 0,
    "SIGNAL_WEIGHT_MAX is empty — every signal just inherited WEIGHT_MAX",
  );
});

Deno.test("Partnered's ceiling is 2, pinned by name, distinct from its default weight of 1", () => {
  // The default weight (1, the value-preserving split) and the ceiling (2,
  // Pato's MESITA-1410 decision carried forward at MESITA-1858) are two
  // different numbers on purpose: the default changes nothing on landing, and
  // the ceiling is how far an operator may turn the dial from the console.
  assertEquals(weightMaxFor("partnered"), 2);
  assertNotEquals(weightMaxFor("partnered"), DISCOVERY_DEFAULTS.weights.partnered);
});

Deno.test("Enriched's ceiling is 2 as well — recorded, not inherited", () => {
  // MESITA-1858 asked for this to be decided and written down. Enriched floors
  // at 0.15, so the uniform 4 would demote an unenriched place ~1,975x — a
  // catalog filtered to enriched-only wearing a weight's clothing.
  assertEquals(weightMaxFor("enriched"), 2);
  assertNotEquals(weightMaxFor("enriched"), WEIGHT_MAX);
});

Deno.test("only the two binaries are capped — the other seven keep the uniform ceiling", () => {
  for (const key of SIGNAL_KEYS) {
    if (key === "partnered" || key === "enriched") continue;
    assertEquals(weightMaxFor(key), WEIGHT_MAX, `${key} should keep WEIGHT_MAX`);
  }
  // A cap equal to WEIGHT_MAX would be a no-op dressed as a guard.
  assertNotEquals(weightMaxFor("partnered"), WEIGHT_MAX);
});

Deno.test("the retired mesita_level key carries no ceiling of its own", () => {
  // It is not a SignalKey any more. If this ever comes back true, the split
  // was reverted halfway and the alias fold is masking it.
  assertEquals(
    (SIGNAL_WEIGHT_MAX as Record<string, number | undefined>).mesita_level,
    undefined,
  );
  assert(!(SIGNAL_KEYS as readonly string[]).includes("mesita_level"));
});

Deno.test("a console write above Partnered's ceiling is clamped, not accepted", () => {
  const cfg = normalizeDiscoveryConfig({
    weights: { partnered: 4, enriched: 4, proximity: 4 },
  });
  // The bought axis is held at its ceiling...
  assertEquals(cfg.weights.partnered, 2);
  assertEquals(cfg.weights.enriched, 2);
  // ...while an earned one is still free to reach the uniform max, so this is
  // a targeted guard and not a global de-tuning.
  assertEquals(cfg.weights.proximity, 4);
});

Deno.test("the ceiling keeps the bought span an order of magnitude below the uniform max", () => {
  // The arithmetic the ceiling exists for, written by hand. At the cap, a
  // partner beats a free place by 25x — large, deliberately so, but a span
  // the other eight signals can still argue with. At the uniform max (625x)
  // far less so.
  const span = (w: number) => (1 / PARTNERED_OFF) ** w;
  assertEquals(span(weightMaxFor("partnered")), 25);
  assertEquals(span(WEIGHT_MAX), 625);
  // And Enriched's, which floors lower and so spans wider at the same w.
  const enrichedSpan = (w: number) => (1 / ENRICHED_OFF) ** w;
  assert(enrichedSpan(2) > 44 && enrichedSpan(2) < 45, "expected ~44.4x at w=2");
  assert(
    enrichedSpan(WEIGHT_MAX) > 1_950 && enrichedSpan(WEIGHT_MAX) < 2_000,
    "expected ~1,975x at the uniform max",
  );
});

Deno.test("the admin console mirrors the ceiling it renders — non-empty, and by name", () => {
  // catalog.ts is a hand-maintained mirror of this module (it says so at
  // WEIGHT_MIN). The EF clamps server-side either way, so drift here is not a
  // correctness bug — it is a console that offers a number the backend then
  // silently refuses, which is worse to debug than a rejected write.
  //
  // THREE ASSERTIONS, NOT ONE LOOP. The loop alone was the vacuous test: with
  // an empty map it asserted nothing at all.
  const twinKeys = CATALOG_SRC.match(
    /SIGNAL_WEIGHT_MAX: Partial<Record<SignalKey, number>> = \{([^}]*)\}/,
  );
  assert(twinKeys, "could not find SIGNAL_WEIGHT_MAX in catalog.ts");
  assert(
    /\w+:\s*\d/.test(twinKeys[1]),
    "catalog.ts SIGNAL_WEIGHT_MAX is empty — the console just offered a 4",
  );
  // By name, both halves, so neither can quietly drop the money cap.
  assertEquals(weightMaxFor("partnered"), 2);
  assert(
    /partnered:\s*2\s*,/.test(CATALOG_SRC),
    "catalog.ts must mirror SIGNAL_WEIGHT_MAX.partnered = 2",
  );
  assert(
    /enriched:\s*2\s*,/.test(CATALOG_SRC),
    "catalog.ts must mirror SIGNAL_WEIGHT_MAX.enriched = 2",
  );
  // And the loop, kept for anything added later.
  for (const [key, cap] of Object.entries(SIGNAL_WEIGHT_MAX)) {
    const pattern = new RegExp(`${key}:\\s*${cap}\\s*,`);
    assertEquals(
      pattern.test(CATALOG_SRC),
      true,
      `catalog.ts must mirror SIGNAL_WEIGHT_MAX.${key} = ${cap}`,
    );
  }
});

Deno.test("both packages agree on the wired-mode column set", () => {
  // Mode keys are PERSISTED. `swipe` is the stored key and Scroll only its
  // label, and these two files pin each OTHER — a rename on one side alone
  // does not fail a type check anywhere, it silently resets live config to
  // the in-code defaults on the next read.
  const listed = CATALOG_SRC.match(/export const WEIGHTED_MODE_KEYS = \[([^\]]*)\]/);
  assert(listed, "could not find WEIGHTED_MODE_KEYS in catalog.ts");
  const twin = [...listed[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assertEquals(twin, [...WEIGHTED_MODE_KEYS]);
  // …and the admin twin rebuilds the same bag key by key, with the same
  // fallback: a missing column seeds from THIS BLOB's vector, never from the
  // in-code defaults. Seeding from defaults would revert every hand-tuned
  // global exponent the first time the console loaded.
  assertEquals(
    CATALOG_SRC.includes("num(bag[key], weights[key], WEIGHT_MIN, weightMaxFor(key))"),
    true,
    "catalog.ts must mirror the weightsByMode clamp and its fallback",
  );
});

Deno.test("both packages agree on the nine signal keys", () => {
  // Mode keys and signal keys are PERSISTED. A rename on one side alone does
  // not fail a type check — it silently resets live config to defaults.
  const listed = CATALOG_SRC.match(/export const SIGNAL_KEYS = \[([^\]]*)\]/);
  assert(listed, "could not find SIGNAL_KEYS in catalog.ts");
  const twin = [...listed[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assertEquals(twin, [...SIGNAL_KEYS]);
});

// ── Full key coverage (MESITA-1858) ─────────────────────────────────────────
//
// THE WORST FAILURE THIS PR COULD SHIP. `normalizeDiscoveryConfig` does
// `Object.keys(DEFAULT_SIGNAL_PARAMS[key])` for every SIGNAL_KEYS entry. A
// missing entry there is `Object.keys(undefined)` — a TypeError, which
// `loadDiscoveryConfig`'s catch swallows, returning DISCOVERY_DEFAULTS for the
// ENTIRE config, on EVERY request, silently and forever. Adding a signal key
// without adding its param bag is exactly how that happens.

Deno.test("every Record<SignalKey, ...> map in this package has full key coverage", () => {
  const expected = [...SIGNAL_KEYS].sort();
  const maps: Record<string, Record<string, unknown>> = {
    SIGNALS,
    SIGNAL_LABELS,
    SIGNAL_BLURBS,
    DEFAULT_SIGNAL_PARAMS,
    SIGNAL_PARAM_BOUNDS,
    "DISCOVERY_DEFAULTS.weights": DISCOVERY_DEFAULTS.weights,
    "DISCOVERY_DEFAULTS.weightsByMode.map": DISCOVERY_DEFAULTS.weightsByMode.map,
    "DISCOVERY_DEFAULTS.weightsByMode.swipe":
      DISCOVERY_DEFAULTS.weightsByMode.swipe,
  };
  for (const [label, map] of Object.entries(maps)) {
    assertEquals(Object.keys(map).sort(), expected, `${label} is missing a signal key`);
  }
});

Deno.test("normalize survives a config with no weights at all", () => {
  // The shape the TypeError above would have been found by: if any exhaustive
  // map is short a key, this throws instead of returning defaults.
  const cfg = normalizeDiscoveryConfig({});
  assertEquals(cfg.weights, DISCOVERY_DEFAULTS.weights);
  for (const key of SIGNAL_KEYS) {
    assert(cfg.params[key] !== undefined, `params.${key} is undefined`);
  }
});

// ── The deploy window (MESITA-1858) ─────────────────────────────────────────
//
// web-admin auto-deploys on merge; Edge Functions deploy by hand. Between the
// two, one side knows nine signal keys and the other knows eight. A normalizer
// that rebuilds `weights` from its own SIGNAL_KEYS evicts whatever the other
// side needs, and the operator's number is gone with nothing in any log.

Deno.test("a pre-migration blob survives a normalize round-trip", () => {
  const before = {
    weights: { mesita_level: 2, proximity: 1.5, randomness: 0.35 },
  };
  const cfg = normalizeDiscoveryConfig(before);
  const kept = cfg.weights as unknown as Record<string, number>;
  assertEquals(kept.mesita_level, 2, "the operator's tuned 2 was evicted from the blob");
  assertEquals(cfg.weights.proximity, 1.5);
});

Deno.test("an unrelated Save does not lose the legacy key — the actual failure mode", () => {
  // The real scenario: Vercel ships, the operator saves the CHAT PROMPT, and
  // the still-old EF reads back a blob the new console just rewrote. The save
  // path is `weights: live.config.weights` where `live.config` came from a
  // normalize, so a round-trip is exactly what a save does to the weights.
  const stored: Record<string, unknown> = {
    weights: { mesita_level: 2, proximity: 1.5 },
    chat: { prompt: "before" },
  };
  const first = normalizeDiscoveryConfig(stored);
  const afterSave = normalizeDiscoveryConfig({
    ...first,
    chat: { prompt: "after" },
  });
  assertEquals(
    (afterSave.weights as unknown as Record<string, number>).mesita_level,
    2,
    "saving an unrelated section silently halved an operator-set exponent",
  );
  assertEquals(afterSave.chat.prompt, "after");
});

Deno.test("the legacy key is READ as a deprecated alias, onto both halves", () => {
  resetLegacySignalWarnings();
  const cfg = normalizeDiscoveryConfig({ weights: { mesita_level: 2 } });
  // Folded onto both, because Level was both facts at once: dropping the
  // operator's number back to the default 1 on either half is a silent
  // re-tune, not a migration.
  assertEquals(cfg.weights.enriched, 2);
  assertEquals(cfg.weights.partnered, 2);
});

Deno.test("an explicitly-set new key wins over the legacy alias", () => {
  resetLegacySignalWarnings();
  const cfg = normalizeDiscoveryConfig({
    weights: { mesita_level: 2, partnered: 0.5, enriched: 1.25 },
  });
  assertEquals(cfg.weights.partnered, 0.5);
  assertEquals(cfg.weights.enriched, 1.25);
});

Deno.test("dropping a legacy key logs ONCE, structured", () => {
  // Nothing logged this before MESITA-1858, which is the difference between
  // "we changed the blob" and "the operator's numbers vanished and nobody
  // knows when". Once per key per process: a ranking EF normalizes on every
  // request, and a line per request buries the one that matters.
  resetLegacySignalWarnings();
  const original = console.warn;
  const lines: unknown[][] = [];
  console.warn = (...args: unknown[]) => void lines.push(args);
  try {
    normalizeDiscoveryConfig({ weights: { mesita_level: 2 } });
    normalizeDiscoveryConfig({ weights: { mesita_level: 2 } });
    normalizeDiscoveryConfig({ weights: { mesita_level: 3 } });
  } finally {
    console.warn = original;
  }
  assertEquals(lines.length, 1, `expected one warn, got ${lines.length}`);
  assertEquals(lines[0][0], "[discovery-config] legacy signal key");
  const payload = lines[0][1] as Record<string, unknown>;
  assertEquals(payload.key, "mesita_level");
  assertEquals(payload.value, 2);
  assertEquals(payload.foldedTo, ["enriched", "partnered"]);
  // Structured, not interpolated: a grep-able object, not a sentence.
  assertEquals(typeof payload, "object");
});

// ── Per-mode exponents (MESITA-1859) ────────────────────────────────────────
//
// `weightsByMode` is rebuilt key by key like every other branch of the
// normalizer, which is why these tests exist: a key the loop forgets is
// dropped on the next unrelated Save, nothing throws, and no test goes red
// unless one asserts the survival directly.

Deno.test("a per-mode exponent round-trips, clamped to that signal's ceiling", () => {
  const cfg = normalizeDiscoveryConfig({
    weightsByMode: { map: { proximity: 2, partnered: 4 } },
  });
  assertEquals(cfg.weightsByMode.map.proximity, 2);
  // Partnered's ceiling is 2, not the uniform 4 — money may not become a sort
  // key from the console, on any mode.
  assertEquals(cfg.weightsByMode.map.partnered, 2);
  // Scroll is untouched by a Map-only blob.
  assertEquals(
    cfg.weightsByMode.swipe,
    DISCOVERY_DEFAULTS.weightsByMode.swipe,
  );
  // Rounded to two decimals, or the admin field (step 0.05) would leave the
  // page permanently dirty against its own saved value.
  assertEquals(
    normalizeDiscoveryConfig({ weightsByMode: { swipe: { timing: 1.7000000000000002 } } })
      .weightsByMode.swipe.timing,
    1.7,
  );
});

Deno.test("a pre-1859 blob with no weightsByMode scores exactly as it did", () => {
  // THE MIGRATION, IN ONE ASSERTION. The live blob carries HAND-TUNED global
  // exponents. Seeding a missing column from DISCOVERY_DEFAULTS instead of
  // from this blob's own vector would revert every one of them on the first
  // read after deploy — a silent re-tune of the live deck, with nothing in
  // any log. So 1.5 has to come back as 1.5, on both columns.
  const cfg = normalizeDiscoveryConfig({ weights: { proximity: 1.5 } });
  for (const mode of WEIGHTED_MODE_KEYS) {
    assertEquals(cfg.weightsByMode[mode], cfg.weights);
    assertEquals(cfg.weightsByMode[mode].proximity, 1.5);
  }
  // An untouched blob lands on the shipped defaults, unchanged.
  for (const mode of WEIGHTED_MODE_KEYS) {
    assertEquals(
      normalizeDiscoveryConfig({}).weightsByMode[mode],
      DISCOVERY_DEFAULTS.weights,
    );
  }
  // …and the mode that ranks reads the same numbers it read yesterday.
  assertEquals(
    weightsForMode("swipe", cfg.weights, cfg.weightsByMode),
    weightsForMode("swipe", cfg.weights),
  );
});

Deno.test("an unrelated Save does not lose a per-mode exponent", () => {
  // The same shape as the mesita_level incident above: the console saves the
  // CHAT PROMPT, and the save path round-trips the whole blob through this
  // normalizer. A forgotten branch silently reverts every tuned column.
  const stored = {
    weightsByMode: { swipe: { proximity: 2.25 }, map: { timing: 0.5 } },
    chat: { prompt: "before" },
  };
  const first = normalizeDiscoveryConfig(stored);
  const afterSave = normalizeDiscoveryConfig({ ...first, chat: { prompt: "after" } });
  assertEquals(afterSave.weightsByMode.swipe.proximity, 2.25);
  assertEquals(afterSave.weightsByMode.map.timing, 0.5);
  assertEquals(afterSave.chat.prompt, "after");
});

Deno.test("only the wired modes are stored — no column for a mode nothing ranks", () => {
  const cfg = normalizeDiscoveryConfig({
    weightsByMode: { word: { name: 3 }, catalog: { proximity: 3 }, favorites: { timing: 3 } },
  });
  assertEquals(Object.keys(cfg.weightsByMode).sort(), [...WEIGHTED_MODE_KEYS].sort());
  // Word's stored number is not merely unused, it is not stored at all — and
  // Word still ranks off the global vector.
  assertEquals(
    weightsForMode("word", cfg.weights, cfg.weightsByMode).name,
    DISCOVERY_DEFAULTS.weights.name,
  );
});

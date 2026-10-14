import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  DISCOVERY_MODE_SIGNALS,
  modeSignalState,
  WEIGHTED_MODE_KEYS,
  weightsForMode,
  type DiscoveryModeKey,
} from "./discovery-matrix.ts";
import { SIGNAL_KEYS } from "./discovery-signals.ts";

Deno.test("Mesita Places Search signals match the admin matrix", () => {
  assertEquals(modeSignalState("word", "name"), "on");
  assertEquals(modeSignalState("word", "enriched"), "off");
  assertEquals(modeSignalState("chat", "name"), "on");
  assertEquals(modeSignalState("chat", "randomness"), "off");
  assertEquals(modeSignalState("map", "proximity"), "on");
  assertEquals(modeSignalState("map", "randomness"), "zero");
  assertEquals(modeSignalState("swipe", "randomness"), "on");
  // Every mode Mesita Level was on for reads Enriched.
  assertEquals(modeSignalState("catalog", "enriched"), "on");
  assertEquals(modeSignalState("map", "enriched"), "on");
  assertEquals(modeSignalState("swipe", "enriched"), "on");
  assertEquals(modeSignalState("chat", "enriched"), "on");
  assertEquals(
    SIGNAL_KEYS.every((key) => modeSignalState("favorites", key) === "off"),
    true,
  );
});

Deno.test("weightsForMode zeros off and Map randomness against defaults", () => {
  const map = weightsForMode("map", DISCOVERY_DEFAULTS.weights);
  assertEquals(map.randomness, 0);
  assertEquals(map.name, 0);
  assertEquals(map.proximity, DISCOVERY_DEFAULTS.weights.proximity);
  assertEquals(map.enriched, DISCOVERY_DEFAULTS.weights.enriched);
  const word = weightsForMode("word", DISCOVERY_DEFAULTS.weights);
  assertEquals(word.name, DISCOVERY_DEFAULTS.weights.name);
  for (const key of SIGNAL_KEYS) {
    if (key !== "name") assertEquals(word[key], 0);
  }
});

/** Every `weightsForMode("<mode>", …)` written outside a test file. */
async function liveCallerModes(): Promise<Set<string>> {
  const shared = new URL("./", import.meta.url);
  const files: URL[] = [];
  for await (const entry of Deno.readDir(shared)) {
    if (!entry.isFile || !entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    if (entry.name === "discovery-matrix.ts") continue; // where it is defined
    files.push(new URL(entry.name, shared));
  }
  const functions = new URL("../", import.meta.url);
  for await (const entry of Deno.readDir(functions)) {
    if (!entry.isDirectory || entry.name === "_shared") continue;
    const index = new URL(`${entry.name}/index.ts`, functions);
    try {
      await Deno.stat(index);
      files.push(index);
    } catch {
      // A function directory without an index.ts calls nothing.
    }
  }
  const modes = new Set<string>();
  for (const file of files) {
    const src = await Deno.readTextFile(file);
    for (const m of src.matchAll(/weightsForMode\(\s*"([a-z]+)"/g)) {
      modes.add(m[1]);
    }
  }
  return modes;
}

/**
 * THE CONTRACT: a mode earns a stored weight column when BOTH halves hold —
 * some non-test file calls `weightsForMode` for it, AND its mask carries more
 * than one signal.
 *
 * WHAT THIS TEST PREVENTS is the rule being relaxed to "has a caller", which
 * is how the column set was first written down and which Word falsifies. Word's
 * mask is exactly `["name"]`, and Mesita search ranks that lane with the
 * six-signal lineup instead of `weightsForMode("word")`. A one-factor product
 * `s^w` is a monotone transform of `s`, so no exponent can reorder a Word
 * result: a Word column would be a knob that provably changes nothing. It also
 * prevents the opposite drift — a column surviving after its last reader is
 * deleted, which is a console lying about what the engine reads.
 */
Deno.test(
  "a mode earns a weight column only with a live caller AND a mask over one signal — Word has neither the caller nor a mask that can reorder",
  async () => {
    const callers = await liveCallerModes();
    // Not vacuous: if the regex ever stops matching, this line goes red.
    assertEquals(callers.has("word"), false);
    assertEquals(callers.has("swipe"), true);
    assertEquals(callers.has("map"), true);

    for (const mode of WEIGHTED_MODE_KEYS) {
      assertEquals(callers.has(mode), true, `${mode} has no live caller`);
      assertEquals(
        DISCOVERY_MODE_SIGNALS[mode].length > 1,
        true,
        `${mode}'s mask cannot reorder`,
      );
    }
    for (const mode of callers) {
      if ((WEIGHTED_MODE_KEYS as readonly string[]).includes(mode)) continue;
      assertEquals(
        DISCOVERY_MODE_SIGNALS[mode as DiscoveryModeKey].length <= 1,
        true,
        `${mode} calls weightsForMode with a mask that CAN reorder, so it owes a column`,
      );
    }
    assertEquals(DISCOVERY_MODE_SIGNALS.word.length, 1);
  },
);

Deno.test("weightsForMode reads the mode's own column, and falls back to global", () => {
  const byMode = { swipe: { proximity: 2 }, map: { proximity: 0.5 } };
  assertEquals(weightsForMode("swipe", DISCOVERY_DEFAULTS.weights, byMode).proximity, 2);
  assertEquals(weightsForMode("map", DISCOVERY_DEFAULTS.weights, byMode).proximity, 0.5);
  // A signal the column omits falls back to the global vector.
  assertEquals(
    weightsForMode("swipe", DISCOVERY_DEFAULTS.weights, byMode).timing,
    DISCOVERY_DEFAULTS.weights.timing,
  );
  // A MODE the bag omits falls back whole — never to 0, never to undefined.
  // Zeroing here would not throw: discovery-blend short-circuits a
  // non-positive exponent to OFF, every place would score exactly 1, and the
  // deck would silently fall back to incoming order.
  const noMap = weightsForMode("map", DISCOVERY_DEFAULTS.weights, { swipe: { proximity: 2 } });
  assertEquals(noMap.proximity, DISCOVERY_DEFAULTS.weights.proximity);
  assertEquals(weightsForMode("map", DISCOVERY_DEFAULTS.weights, {}).proximity, noMap.proximity);
  // THE MASK IS OUTER. A stored number for a masked-off or zeroed signal is
  // still 0 — the console renders from modeSignalState, and an engine that
  // read the blob first would multiply s^w behind a cell reading "off".
  const loud = { map: { randomness: 4, name: 4 }, swipe: { name: 4 } };
  assertEquals(weightsForMode("map", DISCOVERY_DEFAULTS.weights, loud).randomness, 0);
  assertEquals(weightsForMode("map", DISCOVERY_DEFAULTS.weights, loud).name, 0);
  assertEquals(weightsForMode("swipe", DISCOVERY_DEFAULTS.weights, loud).name, 0);
});

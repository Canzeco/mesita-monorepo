import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  DISCOVERY_ENTITIES,
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_SIGNALS,
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_POOLS,
  DISCOVERY_SOURCES,
  DISCOVERY_SOURCES_NO_CALLER,
  modeCallsSource,
  modeRequiresPool,
  modeReturnsEntity,
  modeSignalState,
  WEIGHTED_MODE_KEYS,
  weightsForMode,
  type DiscoveryModeKey,
} from "./discovery-matrix.ts";
import { SIGNAL_KEYS } from "./discovery-signals.ts";

Deno.test("six modes, nine sources, and the locked mode → source matrix", () => {
  assertEquals([...DISCOVERY_MODE_KEYS], [
    "word",
    "map",
    "catalog",
    "swipe",
    "chat",
    "favorites",
  ]);
  assertEquals([...DISCOVERY_SOURCES], [
    "Google Places Autocomplete Search",
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Mesita Places Name Search",
    "Mesita Places Nearby Search",
    "Mesita Places Browse Search",
    "Mesita Places Flexible Search",
    "Mesita Socials Browse Search",
    "Mesita Socials Flexible Search",
  ]);
  assertEquals([...DISCOVERY_MODE_SOURCES.word], [
    "Google Places Autocomplete Search",
    "Google Places Text Search",
    "Mesita Places Name Search",
  ]);
  assertEquals([...DISCOVERY_MODE_SOURCES.map], [
    "Google Places Nearby Search",
    "Mesita Places Nearby Search",
  ]);
  // Catalog is FLEXIBLE for Places since MESITA-1697 — Home's Feed grew a
  // filter control and consumer-web-list-catalog cuts its pool with the
  // guest's predicates before it plans a rail, so it stopped admitting on
  // nothing. That left "Mesita Places Browse Search" with no caller at all.
  // It KEEPS its row (MESITA-1856): the Sources page never stopped rendering
  // its box, so dropping the row made the Matrix under-report the territory
  // by one. Mesita SOCIALS Browse has a caller — no guest predicate reaches
  // the event rails.
  assertEquals([...DISCOVERY_MODE_SOURCES.catalog], [
    "Mesita Places Flexible Search",
    "Mesita Socials Browse Search",
  ]);
  assertEquals([...DISCOVERY_MODE_SOURCES.swipe], [
    "Mesita Places Flexible Search",
  ]);
  assertEquals([...DISCOVERY_MODE_SOURCES.chat], [
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Mesita Places Flexible Search",
    "Mesita Socials Flexible Search",
  ]);
  assertEquals([...DISCOVERY_MODE_SOURCES.favorites], []);
  // Word never calls Nearby Search: the guest pin biases Autocomplete and
  // Text Search, and a bias is not a second call.
  assertEquals(modeCallsSource("word", "Google Places Nearby Search"), false);
  // Perplexity is not a Source. Chat has no external retrieval behind it.
  assertEquals(
    DISCOVERY_SOURCES.some((s) => s.includes("Perplexity")),
    false,
  );
  // Every Source has at least one caller, or it is named as one that has
  // none. A source may sit in the table with an empty row — Places Browse
  // does — but only deliberately, never by a mode list quietly dropping it.
  assertEquals([...DISCOVERY_SOURCES_NO_CALLER], [
    "Mesita Places Browse Search",
  ]);
  for (const source of DISCOVERY_SOURCES) {
    const called = DISCOVERY_MODE_KEYS.some((mode) =>
      modeCallsSource(mode, source)
    );
    const declaredCallerless =
      (DISCOVERY_SOURCES_NO_CALLER as readonly string[]).includes(source);
    assertEquals(called, !declaredCallerless, source);
  }
  // …and nothing may be declared callerless that is not a Source at all.
  for (const source of DISCOVERY_SOURCES_NO_CALLER) {
    assertEquals(
      (DISCOVERY_SOURCES as readonly string[]).includes(source),
      true,
      source,
    );
  }
});

// THE TYPO HOLE THE SOCIALS RENAME OPENED (MESITA-1856). DISCOVERY_MODE_SOURCES
// is `as const` with no type annotation, so a mode list may name a string that
// is in no source list and still compile — the mode would simply call nothing.
// The test above walks sources → modes; this one walks modes → sources.
Deno.test("no mode names a source that does not exist", () => {
  for (const mode of DISCOVERY_MODE_KEYS) {
    for (const source of DISCOVERY_MODE_SOURCES[mode] as readonly string[]) {
      assertEquals(
        (DISCOVERY_SOURCES as readonly string[]).includes(source),
        true,
        `${mode} → ${source}`,
      );
    }
  }
});

Deno.test("Locations come back on Word alone — Places everywhere, Socials where an event source runs", () => {
  assertEquals(DISCOVERY_ENTITIES.map((e) => e.key), [
    "location",
    "place",
    "social",
  ]);
  assertEquals(modeReturnsEntity("word", "location"), true);
  for (const mode of DISCOVERY_MODE_KEYS) {
    // Every mode answers with Places; only the Autocomplete mode adds Locations.
    assertEquals(modeReturnsEntity(mode, "place"), true);
    assertEquals(
      modeReturnsEntity(mode, "location"),
      modeCallsSource(mode, "Google Places Autocomplete Search"),
    );
    // An entity comes from a source: the modes that answer with a Social are
    // exactly the modes that call a Socials source. Both are Soon, so the row
    // is spec-only until an events engine exists — but it is not arbitrary.
    assertEquals(
      modeReturnsEntity(mode, "social"),
      modeCallsSource(mode, "Mesita Socials Browse Search") ||
        modeCallsSource(mode, "Mesita Socials Flexible Search"),
      mode,
    );
  }
  assertEquals(modeReturnsEntity("catalog", "social"), true);
  assertEquals(modeReturnsEntity("chat", "social"), true);
  assertEquals(modeReturnsEntity("map", "social"), false);
});

Deno.test("three nested place types: Map picks the ring, Feed and Scroll need enrichment", () => {
  // The band IS `Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner
  // Places` from nearby-places.ts, in that order. `listed` retired at
  // MESITA-1856: a row existing is not a gate any mode runs.
  assertEquals(DISCOVERY_POOLS.map((p) => p.key), [
    "google",
    "enriched",
    "partner",
  ]);
  assertEquals(DISCOVERY_POOLS.map((p) => p.label), [
    "Google Places",
    "Mesita Enriched Places",
    "Mesita Partnered Places",
  ]);
  assertEquals(
    (DISCOVERY_POOLS as readonly { key: string }[]).some((p) =>
      p.key === "listed"
    ),
    false,
  );
  // Map is the one mode whose GUEST picks the ring — PlacesScope is exactly
  // these three — and keepListedForScope refuses an unenriched row before it
  // reads the scope at all.
  assertEquals(modeRequiresPool("map", "google"), true);
  assertEquals(modeRequiresPool("map", "enriched"), true);
  assertEquals(modeRequiresPool("map", "partner"), true);
  // requireReady defaults true and Scroll hardcodes it, and requireReady IS
  // the enrichment gate. Neither mode reaches for partners only.
  assertEquals(modeRequiresPool("catalog", "google"), true);
  assertEquals(modeRequiresPool("catalog", "enriched"), true);
  assertEquals(modeRequiresPool("catalog", "partner"), false);
  assertEquals(modeRequiresPool("swipe", "google"), true);
  assertEquals(modeRequiresPool("swipe", "enriched"), true);
  assertEquals(modeRequiresPool("swipe", "partner"), false);
  // A bookmark is always a Google-sourced place, and it is NOT gated on
  // enrichment: Create stubs get bookmarked too.
  assertEquals(modeRequiresPool("favorites", "google"), true);
  assertEquals(modeRequiresPool("favorites", "enriched"), false);
  assertEquals(modeRequiresPool("favorites", "partner"), false);
  // Word and Chat answer from whatever came back; no ring gate at all.
  for (const pool of DISCOVERY_POOLS) {
    assertEquals(modeRequiresPool("word", pool.key), false, pool.key);
    assertEquals(modeRequiresPool("chat", pool.key), false, pool.key);
  }
  // No row is dead: every place type is required by at least one mode.
  for (const pool of DISCOVERY_POOLS) {
    assertEquals(
      DISCOVERY_MODE_KEYS.some((mode) => modeRequiresPool(mode, pool.key)),
      true,
      pool.key,
    );
  }
});

Deno.test("Mesita Places Search signals match the admin matrix", () => {
  assertEquals(modeSignalState("word", "name"), "on");
  assertEquals(modeSignalState("word", "summary"), "off");
  assertEquals(modeSignalState("word", "enriched"), "off");
  assertEquals(modeSignalState("word", "partnered"), "off");
  assertEquals(modeSignalState("chat", "summary"), "on");
  assertEquals(modeSignalState("chat", "randomness"), "off");
  assertEquals(modeSignalState("map", "proximity"), "on");
  assertEquals(modeSignalState("map", "randomness"), "zero");
  assertEquals(modeSignalState("swipe", "randomness"), "on");
  // Splitting one on-signal into two on-signals is the identity transform:
  // every mode Level was on for gets both halves, and no mode gains one.
  assertEquals(modeSignalState("catalog", "enriched"), "on");
  assertEquals(modeSignalState("map", "enriched"), "on");
  assertEquals(modeSignalState("swipe", "enriched"), "on");
  assertEquals(modeSignalState("chat", "enriched"), "on");
  assertEquals(modeSignalState("catalog", "partnered"), "on");
  // Map prices partnership by splitting lanes, not by an exponent — see the
  // DISCOVERY_MODE_SIGNAL_ZERO entry. Its own test is below.
  assertEquals(modeSignalState("map", "partnered"), "zero");
  assertEquals(modeSignalState("swipe", "partnered"), "on");
  assertEquals(modeSignalState("chat", "partnered"), "on");
  assertEquals(
    SIGNAL_KEYS.every((key) => modeSignalState("favorites", key) === "off"),
    true,
  );
});

Deno.test("weightsForMode zeros off and Map randomness against defaults", () => {
  const map = weightsForMode("map", DISCOVERY_DEFAULTS.weights);
  assertEquals(map.randomness, 0);
  assertEquals(map.name, 0);
  assertEquals(map.summary, 0);
  assertEquals(map.proximity, DISCOVERY_DEFAULTS.weights.proximity);
  assertEquals(map.enriched, DISCOVERY_DEFAULTS.weights.enriched);
  assertEquals(map.partnered, 0);
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
 * is how the column set was first written down and which Word falsifies. Word
 * has two live callers (`orderDeepLineup` and its fast sibling in
 * consumer-search-lane.ts) and a mask of exactly `["name"]`. A one-factor
 * product `s^w` is a monotone transform of `s`, so no exponent can reorder a
 * Word result: a Word column would be a knob that provably changes nothing,
 * and the caller-set rule alone would ship it. It also prevents the opposite
 * drift — a column surviving after its last reader is deleted, which is a
 * console lying about what the engine reads.
 */
Deno.test(
  "a mode earns a weight column only with a live caller AND a mask over one signal — Word has the caller and not the mask",
  async () => {
    const callers = await liveCallerModes();
    // Not vacuous: if the regex ever stops matching, this line goes red.
    assertEquals(callers.has("word"), true);
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

Deno.test(
  "Map prices partnership by splitting lanes, not by an exponent — so Partnered is zero there",
  () => {
    // `reorderListedLanes` (nearby-lineup.ts) splits the listed rows with
    // `isMesitaPartnerRow` BEFORE it blends, and blends each lane on its own.
    // On those rows the predicate reduces to `isPaidPlan(row.plan)` —
    // PLACE_CARD_COLUMNS has no `partner` key — and `partnered()` is 1 on any
    // non-free plan, 0.2 otherwise. A constant factor inside a lane, and s^w
    // over a constant is a constant: the exponent cannot move a row. Same
    // argument that denies Word a column, applied per signal.
    assertEquals(modeSignalState("map", "partnered"), "zero");
    for (const w of [0, 0.5, 1, 2]) {
      assertEquals(
        weightsForMode("map", DISCOVERY_DEFAULTS.weights, {
          map: { partnered: w },
        }).partnered,
        0,
        `a stored ${w} must not reach the engine`,
      );
    }
    // Scroll ranks one deck with no lane split, so there the exponent is real.
    assertEquals(modeSignalState("swipe", "partnered"), "on");
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

Deno.test("this file is a spec mirror — it does not import Nearby Search", async () => {
  const src = await Deno.readTextFile(
    new URL("./discovery-matrix.ts", import.meta.url),
  );
  assertEquals(src.includes("from \"./google-places"), false);
  assertEquals(src.includes("GOOGLE_PLACES_NEARBY"), false);
});

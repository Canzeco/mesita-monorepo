import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  DISCOVERY_ENTITIES,
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_POOLS,
  DISCOVERY_SOURCES,
  DISCOVERY_SOURCES_NO_CALLER,
  modeCallsSource,
  modeRequiresPool,
  modeReturnsEntity,
  modeSignalState,
  weightsForMode,
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
  assertEquals(modeSignalState("word", "mesita_level"), "off");
  assertEquals(modeSignalState("chat", "summary"), "on");
  assertEquals(modeSignalState("chat", "randomness"), "off");
  assertEquals(modeSignalState("map", "proximity"), "on");
  assertEquals(modeSignalState("map", "randomness"), "zero");
  assertEquals(modeSignalState("swipe", "randomness"), "on");
  assertEquals(modeSignalState("catalog", "mesita_level"), "on");
  assertEquals(modeSignalState("map", "mesita_level"), "on");
  assertEquals(modeSignalState("swipe", "mesita_level"), "on");
  assertEquals(modeSignalState("chat", "mesita_level"), "on");
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
  assertEquals(map.mesita_level, DISCOVERY_DEFAULTS.weights.mesita_level);
  const word = weightsForMode("word", DISCOVERY_DEFAULTS.weights);
  assertEquals(word.name, DISCOVERY_DEFAULTS.weights.name);
  for (const key of SIGNAL_KEYS) {
    if (key !== "name") assertEquals(word[key], 0);
  }
});

Deno.test("this file is a spec mirror — it does not import Nearby Search", async () => {
  const src = await Deno.readTextFile(
    new URL("./discovery-matrix.ts", import.meta.url),
  );
  assertEquals(src.includes("from \"./google-places"), false);
  assertEquals(src.includes("GOOGLE_PLACES_NEARBY"), false);
});

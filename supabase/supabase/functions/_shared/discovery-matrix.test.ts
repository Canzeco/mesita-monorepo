import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  DISCOVERY_ENTITIES,
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_SOURCES,
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
    "Mesita Social Browse Search",
    "Mesita Social Flexible Search",
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
  assertEquals([...DISCOVERY_MODE_SOURCES.catalog], [
    "Mesita Places Browse Search",
    "Mesita Social Browse Search",
  ]);
  assertEquals([...DISCOVERY_MODE_SOURCES.swipe], [
    "Mesita Places Flexible Search",
  ]);
  assertEquals([...DISCOVERY_MODE_SOURCES.chat], [
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Mesita Places Flexible Search",
    "Mesita Social Flexible Search",
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
  // Every Source has at least one caller, or it is not in the taxonomy.
  for (const source of DISCOVERY_SOURCES) {
    assertEquals(
      DISCOVERY_MODE_KEYS.some((mode) => modeCallsSource(mode, source)),
      true,
      source,
    );
  }
});

Deno.test("Locations come back on Word alone — Places come back everywhere", () => {
  assertEquals(DISCOVERY_ENTITIES.map((e) => e.key), ["place", "location"]);
  assertEquals(modeReturnsEntity("word", "location"), true);
  for (const mode of DISCOVERY_MODE_KEYS) {
    // Every mode answers with Places; only the Autocomplete mode adds Locations.
    assertEquals(modeReturnsEntity(mode, "place"), true);
    assertEquals(
      modeReturnsEntity(mode, "location"),
      modeCallsSource(mode, "Google Places Autocomplete Search"),
    );
  }
});

Deno.test("pool mask is Google + Listed on Catalog · Swipe; Favorites requires Google Places", () => {
  assertEquals(modeRequiresPool("swipe", "google"), true);
  assertEquals(modeRequiresPool("swipe", "listed"), true);
  assertEquals(modeRequiresPool("catalog", "google"), true);
  assertEquals(modeRequiresPool("catalog", "listed"), true);
  assertEquals(modeRequiresPool("favorites", "google"), true);
  assertEquals(modeRequiresPool("favorites", "listed"), false);
  assertEquals(modeRequiresPool("favorites", "enriched"), false);
  assertEquals(modeRequiresPool("word", "listed"), false);
  assertEquals(modeRequiresPool("chat", "google"), false);
  assertEquals(modeRequiresPool("map", "enriched"), false);
  assertEquals(modeRequiresPool("swipe", "enriched"), false);
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

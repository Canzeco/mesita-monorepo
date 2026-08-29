import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  DISCOVERY_MODE_MODULES,
  DISCOVERY_MODULES,
  modeCallsModule,
  modeRequiresPool,
  modeSignalState,
  weightsForMode,
} from "./discovery-matrix.ts";
import { SIGNAL_KEYS } from "./discovery-signals.ts";

Deno.test("seven modules and the locked mode → module matrix", () => {
  assertEquals([...DISCOVERY_MODULES], [
    "Google Places Autocomplete",
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Perplexity Search",
    "Perplexity Agent",
    "Mesita Places Lineup",
    "Mesita Social Lineup",
  ]);
  assertEquals([...DISCOVERY_MODE_MODULES.fast], [
    "Google Places Autocomplete",
  ]);
  assertEquals([...DISCOVERY_MODE_MODULES.deep], [
    "Google Places Autocomplete",
    "Google Places Text Search",
    "Mesita Places Lineup",
  ]);
  assertEquals([...DISCOVERY_MODE_MODULES.map], [
    "Google Places Nearby Search",
    "Mesita Places Lineup",
  ]);
  assertEquals([...DISCOVERY_MODE_MODULES.chat], [
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Perplexity Search",
    "Perplexity Agent",
    "Mesita Places Lineup",
  ]);
  assertEquals([...DISCOVERY_MODE_MODULES.social], ["Mesita Social Lineup"]);
  assertEquals([...DISCOVERY_MODE_MODULES.favorites], []);
  assertEquals(modeCallsModule("chat", "Mesita Social Lineup"), false);
  assertEquals(modeCallsModule("deep", "Google Places Nearby Search"), false);
});

Deno.test("pool mask is Google + Listed on Swipe · Catalog · Social · Favorites", () => {
  assertEquals(modeRequiresPool("swipe", "google"), true);
  assertEquals(modeRequiresPool("swipe", "listed"), true);
  assertEquals(modeRequiresPool("favorites", "listed"), true);
  assertEquals(modeRequiresPool("deep", "listed"), false);
  assertEquals(modeRequiresPool("chat", "google"), false);
  assertEquals(modeRequiresPool("map", "enriched"), false);
  assertEquals(modeRequiresPool("swipe", "enriched"), false);
});

Deno.test("Places Lineup signals match the admin matrix", () => {
  assertEquals(modeSignalState("deep", "name"), "on");
  assertEquals(modeSignalState("deep", "summary"), "off");
  assertEquals(modeSignalState("chat", "summary"), "on");
  assertEquals(modeSignalState("chat", "randomness"), "off");
  assertEquals(modeSignalState("map", "proximity"), "on");
  assertEquals(modeSignalState("map", "randomness"), "zero");
  assertEquals(modeSignalState("swipe", "randomness"), "on");
  assertEquals(modeSignalState("catalog", "partnership"), "on");
  assertEquals(modeSignalState("social", "name"), "off");
  assertEquals(modeSignalState("favorites", "proximity"), "off");
  assertEquals(
    SIGNAL_KEYS.every((key) => modeSignalState("fast", key) === "off"),
    true,
  );
  assertEquals(modeSignalState("chat", "social"), "off");
});

Deno.test("weightsForMode zeros off and Map randomness against defaults", () => {
  const map = weightsForMode("map", DISCOVERY_DEFAULTS.weights);
  assertEquals(map.randomness, 0);
  assertEquals(map.name, 0);
  assertEquals(map.summary, 0);
  assertEquals(map.proximity, DISCOVERY_DEFAULTS.weights.proximity);
  assertEquals(map.partnership, DISCOVERY_DEFAULTS.weights.partnership);
  const deep = weightsForMode("deep", DISCOVERY_DEFAULTS.weights);
  assertEquals(deep.name, DISCOVERY_DEFAULTS.weights.name);
  for (const key of SIGNAL_KEYS) {
    if (key !== "name") assertEquals(deep[key], 0);
  }
});

Deno.test("this file is a spec mirror — it does not import Nearby Search", async () => {
  const src = await Deno.readTextFile(
    new URL("./discovery-matrix.ts", import.meta.url),
  );
  assertEquals(src.includes("from \"./google-places"), false);
  assertEquals(src.includes("GOOGLE_PLACES_NEARBY"), false);
});

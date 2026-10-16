import { assertEquals } from "jsr:@std/assert@1";
import {
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_SOURCES,
  modesCallingSource,
} from "./discovery-surface.ts";

const root = new URL("../../", import.meta.url);

async function text(rel: string): Promise<string> {
  return await Deno.readTextFile(new URL(rel, root));
}

Deno.test("surface routing matches the engines that actually retrieve", async () => {
  const lane = await text("functions/_shared/consumer-search-lane.ts");
  const map = await text("functions/consumer-web-list-places/index.ts");
  const catalog = await text("functions/consumer-web-list-catalog/index.ts");
  const swipe = await text("functions/consumer-web-recommend-swipe/index.ts");
  const chat = await text("functions/consumer-web-ask-memo/index.ts");

  assertEquals(lane.includes("searchNearbyPlaces"), false);
  assertEquals(lane.includes("autocomplete"), true);
  assertEquals(lane.includes("fetchEmbedPool"), true);
  assertEquals(map.includes("searchNearbyPlaces"), true);
  assertEquals(catalog.includes("rankFamilyLists"), true);
  assertEquals(swipe.includes("rankFamilyLists"), false);
  assertEquals(swipe.includes('.from("profiles")'), true);
  assertEquals(chat.includes("searchNearbyPlaces"), false);
  assertEquals(chat.includes("searchText"), false);

  assertEquals(DISCOVERY_MODE_SOURCES.word, [
    "google_autocomplete",
    "google_text",
    "mesita_name",
  ]);
  assertEquals(DISCOVERY_MODE_SOURCES.map, ["google_nearby", "mesita_nearby"]);
  assertEquals(DISCOVERY_MODE_SOURCES.catalog, ["mesita_catalog"]);
  assertEquals(DISCOVERY_MODE_SOURCES.swipe, ["mesita_catalog"]);
  assertEquals(DISCOVERY_MODE_SOURCES.chat, []);
  assertEquals(DISCOVERY_MODE_SOURCES.favorites, []);
  assertEquals(modesCallingSource("mesita_social"), []);
  assertEquals(
    DISCOVERY_SOURCES.find((s) => s.key === "mesita_social")?.availability,
    "unavailable",
  );
});

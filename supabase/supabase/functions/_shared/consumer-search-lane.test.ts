// deno test supabase/functions/_shared/consumer-search-lane.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import {
  MESITA_NAME_MIN_CAP,
  mesitaNameCap,
  resolveMode,
  admitNameFloor,
  applyResolvedMesitaName,
  classifyPredictionKind,
  deepModuleFlags,
  laneDedupeKeys,
  locationTypeOf,
  mergeNameDeepQueries,
  orderDeepLineup,
  takeFastLane,
  toWire,
  weaveStampedAutocomplete,
  type LaneItem,
  type ListedRow,
} from "./consumer-search-lane.ts";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import { stripPlacesPrefix } from "./google-places.ts";
import { SIGNAL_KEYS, type SignalKey } from "./discovery-signals.ts";
import { CRENUP_TOTAL } from "./crenup-ladder.ts";

function item(over: Partial<LaneItem> & Pick<LaneItem, "placeId" | "mainText">): LaneItem {
  return {
    secondaryText: over.secondaryText ?? "",
    state: over.state ?? "not_in_mesita",
    ...over,
  };
}

Deno.test("laneDedupeKeys prefers google_place_id then Mesita id", () => {
  assertEquals(laneDedupeKeys({ placeId: "ChIJ1", mesitaId: "uuid-1" }), [
    "g:ChIJ1",
    "m:uuid-1",
  ]);
  assertEquals(laneDedupeKeys({ placeId: "", mesitaId: "uuid-1" }), [
    "m:uuid-1",
  ]);
});

Deno.test("takeFastLane keeps Autocomplete order and caps", () => {
  const out = takeFastLane(
    [
      item({ placeId: "a", mainText: "A" }),
      item({ placeId: "b", mainText: "B" }),
      item({ placeId: "c", mainText: "C" }),
      item({ placeId: "d", mainText: "D" }),
    ],
    3,
  );
  assertEquals(out.map((p) => p.placeId), ["a", "b", "c"]);
});

Deno.test("takeFastLane drops a duplicate google id", () => {
  const out = takeFastLane(
    [
      item({ placeId: "ChIJ1", mainText: "First" }),
      item({ placeId: "ChIJ1", mainText: "Dup" }),
      item({ placeId: "ChIJ2", mainText: "Second" }),
    ],
    5,
  );
  assertEquals(out.map((p) => p.mainText), ["First", "Second"]);
});

Deno.test("applyResolvedMesitaName keeps Mesita places.name, not the Google label", () => {
  const out = applyResolvedMesitaName(
    item({
      placeId: "ChIJ1",
      mainText: "Google's Label",
      secondaryText: "Google address",
    }),
    item({
      placeId: "ChIJ1",
      mainText: "Mesita override",
      secondaryText: "Mesita address",
      state: "web_listed",
      enriched: true,
      mesitaId: "m-1",
      mesitaSlug: "mesita-override",
    }),
  );
  assertEquals(out.mainText, "Mesita override");
  assertEquals(out.secondaryText, "Mesita address");
  assertEquals(out.mesitaId, "m-1");
  assertEquals(out.enriched, true);
});

Deno.test("mergeNameDeepQueries: Autocomplete then Text then Mesita", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [item({ placeId: "a1", mainText: "Auto" })],
    text: [item({ placeId: "t1", mainText: "Text" })],
    mesita: [item({ placeId: "m1", mainText: "Mesita", mesitaId: "m-1" })],
  });
  assertEquals(out.map((p) => p.mainText), ["Auto", "Text", "Mesita"]);
});

Deno.test("mergeNameDeepQueries: first query keeps overlaps; union is not sliced", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [
      item({ placeId: "a1", mainText: "A1" }),
      item({ placeId: "a2", mainText: "A2" }),
    ],
    text: [
      item({ placeId: "t1", mainText: "T1" }),
      item({ placeId: "t2", mainText: "T2" }),
    ],
    mesita: [
      item({ placeId: "m1", mainText: "M1", mesitaId: "m-1" }),
      item({ placeId: "m2", mainText: "M2", mesitaId: "m-2" }),
    ],
  });
  assertEquals(out.map((p) => p.mainText), [
    "A1",
    "A2",
    "T1",
    "T2",
    "M1",
    "M2",
  ]);
});

Deno.test("mergeNameDeepQueries: Google-resolved Mesita stays in Autocomplete/Text", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [
      item({
        placeId: "ChIJ1",
        mainText: "Resolved Autocomplete",
        mesitaId: "m-1",
        state: "web_listed",
      }),
    ],
    text: [
      item({
        placeId: "ChIJ2",
        mainText: "Resolved Text",
        mesitaId: "m-2",
        state: "web_listed",
      }),
    ],
    mesita: [
      item({
        placeId: "ChIJ1",
        mainText: "Dup Mesita",
        mesitaId: "m-1",
        state: "web_listed",
      }),
      item({
        placeId: "ChIJ3",
        mainText: "Only Mesita",
        mesitaId: "m-3",
        state: "web_listed",
      }),
    ],
  });
  assertEquals(out.map((p) => p.mainText), [
    "Resolved Autocomplete",
    "Resolved Text",
    "Only Mesita",
  ]);
});

Deno.test("mergeNameDeepQueries: Text Search keeps its own order", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [],
    text: [
      item({ placeId: "g3", mainText: "Third-best text" }),
      item({ placeId: "g1", mainText: "First-best text" }),
      item({ placeId: "g2", mainText: "Second-best text" }),
    ],
    mesita: [],
  });
  assertEquals(out.map((p) => p.mainText), [
    "Third-best text",
    "First-best text",
    "Second-best text",
  ]);
});

Deno.test("stripPlacesPrefix drops the Places API resource prefix", () => {
  assertEquals(stripPlacesPrefix("places/ChIJ123"), "ChIJ123");
  assertEquals(stripPlacesPrefix("ChIJ123"), "ChIJ123");
});

Deno.test("deepModuleFlags: which Deep modules fire", () => {
  const on = {
    autoCount: 3,
    mesitaCount: 3,
    googleCount: 3,
    typesOn: true,
    hasOpenai: true,
  };
  const cases: Array<
    [string, Partial<typeof on>, ReturnType<typeof deepModuleFlags>]
  > = [
    ["types off skip Autocomplete and Text Search", { typesOn: false }, {
      wantAuto: false,
      wantText: false,
      wantMesita: true,
    }],
    ["googleCount 0 keeps Autocomplete, skips Text Search", { googleCount: 0 }, {
      wantAuto: true,
      wantText: false,
      wantMesita: true,
    }],
    ["autoCount 0 skips Autocomplete, keeps Text Search", { autoCount: 0 }, {
      wantAuto: false,
      wantText: true,
      wantMesita: true,
    }],
    ["no OpenAI skips Lineup", { hasOpenai: false }, {
      wantAuto: true,
      wantText: true,
      wantMesita: false,
    }],
    ["all lanes on fire all three modules", {}, {
      wantAuto: true,
      wantText: true,
      wantMesita: true,
    }],
  ];
  for (const [label, over, want] of cases) {
    assertEquals(deepModuleFlags({ ...on, ...over }), want, label);
  }
});

const STAMP = "2026-09-01T00:00:00Z";

function listed(
  id: string,
  name: string,
  embedding: number[],
  enriched_at: string | null = STAMP,
  content_state: string | null = "ready",
): ListedRow {
  return {
    id,
    slug: id,
    google_place_id: `g-${id}`,
    name,
    address: "",
    lat: 19.4,
    lng: -99.1,
    content_state,
    enriched_at,
    business_state: "OPERATIONAL",
    google_review_count: null,
    name_embedding: embedding,
    embedding: null,
  };
}

/** The `attachCrenupHighWater` merge, in fixture form. */
const withHighWater = (row: ListedRow, highWater: number): ListedRow =>
  ({ ...row, crenup_high_water: highWater }) as ListedRow;

const QUERY = [1, 0];
const BEST = listed("best", "Best", [1, 0]);
const WORSE = listed("worse", "Worse", [0.8, 0.6]);

function weights(name: number): Record<SignalKey, number> {
  const out = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) out[key] = 0;
  out.name = name;
  return out;
}

Deno.test("orderDeepLineup: Name 1 vs 4 keeps the same order", () => {
  const pool = [WORSE, BEST];
  const at1 = orderDeepLineup(pool, QUERY, weights(1)).map((r) => r.id);
  const at4 = orderDeepLineup(pool, QUERY, weights(4)).map((r) => r.id);
  assertEquals(at1, ["best", "worse"]);
  assertEquals(at4, ["best", "worse"]);
});

Deno.test("orderDeepLineup: Name 0 vs on reorders an unsorted pool", () => {
  const pool = [WORSE, BEST];
  assertEquals(orderDeepLineup(pool, QUERY, weights(0)).map((r) => r.id), [
    "worse",
    "best",
  ]);
  assertEquals(orderDeepLineup(pool, QUERY, weights(1)).map((r) => r.id), [
    "best",
    "worse",
  ]);
});

Deno.test("orderDeepLineup: the enrichment gradient reorders two enriched rows", () => {
  // Carries "crenup_high_water (MESITA-1601) reorders when Level is weighted"
  // across the MESITA-1858 split, and comes back to high-water for the reason
  // that split's review found: among enriched rows the enrichment BOOLEAN
  // ties. Same name-embedding (so Name ties too) — only high-water differs,
  // which is the only part of Enriched that can reorder them.
  const hi = withHighWater(listed("hi", "Hi", QUERY), CRENUP_TOTAL);
  const lo = withHighWater(listed("lo", "Lo", QUERY), 2);
  // A Created row (ready, enriched_at null — MESITA-2154) is NOT enriched:
  // it floors below both, whatever its content_state or high-water.
  const un = withHighWater(listed("un", "Un", QUERY, null, "ready"), 1);
  const enrichedOnly = weights(0);
  enrichedOnly.enriched = 2;
  assertEquals(
    orderDeepLineup([un, lo, hi], QUERY, enrichedOnly).map((r) => r.id),
    ["hi", "lo", "un"],
  );
});

Deno.test("admitNameFloor uses raw cosine, not remapped name()", () => {
  const below = listed("low", "Low", [0.2, 0.98]);
  const out = admitNameFloor([BEST, below], QUERY, 0.4);
  assertEquals(out.map((r) => r.id), ["best"]);
});

Deno.test("Deep source never calls searchNearbyPlaces", async () => {
  const src = await Deno.readTextFile(
    new URL("./consumer-search-lane.ts", import.meta.url),
  );
  assertEquals(src.includes("searchNearbyPlaces"), false);
  assertEquals(src.includes("applyPlacesCallerRegion"), false);
  assertEquals(src.includes("includedRegionCodes"), false);
  assertEquals(src.includes("rankByBlend"), true);
  assertEquals(src.includes("queryNameVector"), true);
});

Deno.test("mergeNameDeepQueries: overflow Mesita in Text stays; later Mesita skips it", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [],
    text: [
      item({
        placeId: "overflow",
        mainText: "Resolved overflow",
        mesitaId: "m-overflow",
        state: "web_listed",
      }),
      item({ placeId: "fresh", mainText: "Fresh Google" }),
    ],
    mesita: [
      item({ placeId: "top", mainText: "Top Mesita", mesitaId: "m-top" }),
      item({
        placeId: "overflow",
        mainText: "Should skip",
        mesitaId: "m-overflow",
        state: "web_listed",
      }),
    ],
  });
  assertEquals(out.map((p) => p.placeId), ["overflow", "fresh", "top"]);
});

// PAY's engine is the Mesita NAME EMBEDDINGS alone (Pato, 2026-08-29).
Deno.test("resolveMode: mesita is its own mode, unknown still falls back to fast", () => {
  assertEquals(resolveMode("mesita"), "mesita");
  assertEquals(resolveMode("deep"), "deep");
  assertEquals(resolveMode("fast"), "fast");
  assertEquals(resolveMode(undefined), "fast");
  assertEquals(resolveMode(null), "fast");
  // An older client sending nonsense must never silently reach Google
  // with Pay's intent, and must never crash: fast is the safe default.
  assertEquals(resolveMode("MESITA"), "fast");
  assertEquals(resolveMode("embeddings"), "fast");
});

// ── Locations: Word's second entity (MESITA-1403) ─────────────────────

Deno.test("classifyPredictionKind: locality without establishment is a Location", () => {
  assertEquals(
    classifyPredictionKind(["locality", "political", "geocode"]),
    "location",
  );
  assertEquals(
    classifyPredictionKind(["administrative_area_level_1", "political", "geocode"]),
    "location",
  );
  assertEquals(classifyPredictionKind(["postal_code", "geocode"]), "location");
});

Deno.test("classifyPredictionKind: an establishment marker wins outright", () => {
  assertEquals(
    classifyPredictionKind([
      "restaurant",
      "food",
      "point_of_interest",
      "establishment",
    ]),
    "place",
  );
  // A place inside a named area still reads as a place.
  assertEquals(
    classifyPredictionKind(["geocode", "point_of_interest", "establishment"]),
    "place",
  );
});

Deno.test("classifyPredictionKind: missing/empty/unknown types stay Places", () => {
  // An unexpected payload must behave exactly as today.
  assertEquals(classifyPredictionKind(undefined), "place");
  assertEquals(classifyPredictionKind(null), "place");
  assertEquals(classifyPredictionKind([]), "place");
  assertEquals(classifyPredictionKind(["cafe", "food"]), "place");
});

Deno.test("locationTypeOf: most specific type, blanket markers last", () => {
  assertEquals(locationTypeOf(["locality", "political", "geocode"]), "locality");
  assertEquals(
    locationTypeOf(["political", "administrative_area_level_1", "geocode"]),
    "administrative_area_level_1",
  );
  // Blanket-only rows still name something rather than nothing.
  assertEquals(locationTypeOf(["political", "geocode"]), "political");
  assertEquals(locationTypeOf([]), undefined);
});

Deno.test("weaveStampedAutocomplete: Locations hold their slots; gated Places drop", () => {
  const city = item({
    placeId: "loc-1",
    mainText: "Ciudad de México",
    kind: "location",
    locationType: "locality",
  });
  const placeA = item({ placeId: "v-a", mainText: "Place A" });
  const placeB = item({ placeId: "v-b", mainText: "Place B" });
  const resolvedA = item({
    placeId: "v-a",
    mainText: "Mesita Place A",
    mesitaId: "m-a",
    state: "web_listed",
  });
  // Place B died at the gate: only A survived the stamp.
  const out = weaveStampedAutocomplete([placeA, city, placeB], [resolvedA]);
  assertEquals(out.map((p) => p.mainText), ["Mesita Place A", "Ciudad de México"]);
  assertEquals(out[1].kind, "location");
});

Deno.test("toWire: kind rides Location rows only — place rows stay byte-identical", () => {
  const place = toWire(item({ placeId: "v-1", mainText: "Place" }));
  assertEquals("kind" in place, false);
  assertEquals("locationType" in place, false);
  const city = toWire(item({
    placeId: "loc-1",
    mainText: "Ciudad de México",
    kind: "location",
    locationType: "locality",
  }));
  assertEquals(city.kind, "location");
  assertEquals(city.locationType, "locality");
  // A Location has no coordinates from Autocomplete — those arrive on pick.
  assertEquals("lat" in city, false);
  assertEquals("lng" in city, false);
});

Deno.test("Locations dedupe on g:<placeId> like any Google row", () => {
  assertEquals(
    laneDedupeKeys({ placeId: "ChIJcity" }),
    ["g:ChIJcity"],
  );
});

Deno.test("Pay has no Google fallback, so its lane cap never collapses", () => {
  // An operator zeroing the Deep Mesita count would otherwise leave Pay's
  // search permanently empty — Search would still have Autocomplete.
  assertEquals(mesitaNameCap({ mesitaCount: 0 }), MESITA_NAME_MIN_CAP);
  assertEquals(mesitaNameCap({ mesitaCount: 3 }), MESITA_NAME_MIN_CAP);
  // Above the floor the operator's number wins, so Pay and Search agree.
  assertEquals(mesitaNameCap({ mesitaCount: 20 }), 20);
  assertEquals(
    mesitaNameCap(DISCOVERY_DEFAULTS.name.deep),
    Math.max(DISCOVERY_DEFAULTS.name.deep.mesitaCount, MESITA_NAME_MIN_CAP),
  );
});

// MESITA-1874. Pato, on the Add place bar returning ONE result — a bar in
// Toledo, Ohio — for the query `strana`: "use autocomplete and text search
// from google … basically the word search mode but without showing the
// locations results." That bar was the business console's; it went with the
// console (MESITA-2090), and admin's Create Single Place picker is the place
// picker that keeps the rule.
//
// The facade is one call, so what is worth pinning is the three things that
// call could get wrong and still compile: the wrong ENGINE (`suggestPlaces`,
// Autocomplete alone), the wrong MODE (the lane's default is `fast`, which is
// Autocomplete alone again, so leaving the deep default out would silently
// undo this), and LOCATIONS turned on (a place picker must never offer a city).
Deno.test("admin's place picker runs the deep lane, places only", async () => {
  const src = await Deno.readTextFile(
    new URL("../admin-web-suggest-places/index.ts", import.meta.url),
  );
  const code = src.split("\n").filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
  assertEquals(code.includes("runConsumerSearchLane"), true);
  assertEquals(code.includes('"deep"'), true);
  // The engine it left. A comment may name it; the code may not call it.
  assertEquals(code.includes("suggestPlaces"), false);
  // Locations ride the consumer searchbar alone. Absent means false, and the
  // absence IS the assertion — an explicit `true` here would put cities in a
  // list whose every row offers Create.
  assertEquals(code.includes("locations"), false);
});

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
  listedNotPartner,
  locationTypeOf,
  mergeNameDeepQueries,
  orderDeepLineup,
  splitResolvedNameHits,
  stripPlacesPrefix,
  takeFastLane,
  toWire,
  weaveStampedAutocomplete,
  type LaneItem,
  type ListedRow,
} from "./consumer-search-lane.ts";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { SIGNAL_KEYS, type SignalKey } from "./discovery-signals.ts";

function item(over: Partial<LaneItem> & Pick<LaneItem, "placeId" | "mainText">): LaneItem {
  return {
    secondaryText: over.secondaryText ?? "",
    status: over.status ?? "not_in_mesita",
    partner: over.partner ?? false,
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
      status: "web_listed",
      partner: true,
      mesitaId: "m-1",
      mesitaSlug: "mesita-override",
    }),
  );
  assertEquals(out.mainText, "Mesita override");
  assertEquals(out.secondaryText, "Mesita address");
  assertEquals(out.mesitaId, "m-1");
  assertEquals(out.partner, true);
});

Deno.test("splitResolvedNameHits buckets after resolve, before merge", () => {
  const out = splitResolvedNameHits([
    item({ placeId: "p1", mainText: "Partner", partner: true, mesitaId: "m-p" }),
    item({ placeId: "m1", mainText: "Listed", mesitaId: "m-1" }),
    item({ placeId: "g1", mainText: "Google" }),
  ]);
  assertEquals(out.partners.map((p) => p.mainText), ["Partner"]);
  assertEquals(out.mesita.map((p) => p.mainText), ["Listed"]);
  assertEquals(out.google.map((p) => p.mainText), ["Google"]);
});

Deno.test("mergeNameDeepQueries: Autocomplete then Text then Mesita then Partners", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [item({ placeId: "a1", mainText: "Auto" })],
    text: [item({ placeId: "t1", mainText: "Text" })],
    mesita: [item({ placeId: "m1", mainText: "Mesita", mesitaId: "m-1" })],
    partners: [item({ placeId: "p1", mainText: "Partner", partner: true, mesitaId: "m-p" })],
  });
  assertEquals(out.map((p) => p.mainText), ["Auto", "Text", "Mesita", "Partner"]);
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
    partners: [
      item({ placeId: "p1", mainText: "P1", partner: true, mesitaId: "m-p1" }),
      item({ placeId: "p2", mainText: "P2", partner: true, mesitaId: "m-p2" }),
    ],
  });
  assertEquals(out.map((p) => p.mainText), [
    "A1",
    "A2",
    "T1",
    "T2",
    "M1",
    "M2",
    "P1",
    "P2",
  ]);
});

Deno.test("mergeNameDeepQueries: partner already in Mesita query appears once", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [],
    text: [],
    mesita: [
      item({
        placeId: "ChIJ1",
        mainText: "Strana again",
        partner: true,
        mesitaId: "mesita-1",
        status: "web_listed",
      }),
      item({
        placeId: "ChIJ2",
        mainText: "Listed cafe",
        mesitaId: "mesita-2",
        status: "web_listed",
      }),
    ],
    partners: [
      item({
        placeId: "ChIJ1",
        mainText: "Strana",
        partner: true,
        mesitaId: "mesita-1",
        status: "web_listed",
      }),
    ],
  });
  assertEquals(out.map((p) => p.mainText), ["Strana again", "Listed cafe"]);
});

Deno.test("mergeNameDeepQueries: Google-resolved Mesita stays in Autocomplete/Text", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [
      item({
        placeId: "ChIJ1",
        mainText: "Resolved Autocomplete",
        mesitaId: "m-1",
        status: "web_listed",
      }),
    ],
    text: [
      item({
        placeId: "ChIJ2",
        mainText: "Resolved Text",
        mesitaId: "m-2",
        status: "web_listed",
      }),
    ],
    mesita: [
      item({
        placeId: "ChIJ1",
        mainText: "Dup Mesita",
        mesitaId: "m-1",
        status: "web_listed",
      }),
      item({
        placeId: "ChIJ3",
        mainText: "Only Mesita",
        mesitaId: "m-3",
        status: "web_listed",
      }),
    ],
    partners: [
      item({
        placeId: "ChIJ2",
        mainText: "Dup Partner",
        mesitaId: "m-2",
        partner: true,
        status: "web_listed",
      }),
      item({
        placeId: "ChIJ4",
        mainText: "Only Partner",
        mesitaId: "m-4",
        partner: true,
        status: "web_listed",
      }),
    ],
  });
  assertEquals(out.map((p) => p.mainText), [
    "Resolved Autocomplete",
    "Resolved Text",
    "Only Mesita",
    "Only Partner",
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
    partners: [],
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

Deno.test("listedNotPartner drops paid-plan rows from the Mesita Lineup lane", () => {
  const out = listedNotPartner([
    { plan: "premium" },
    { plan: "partner" },
    { plan: "free" },
    { plan: null },
  ]);
  assertEquals(out.map((r) => r.plan), ["free", null]);
});

Deno.test("deepModuleFlags: types off skip Autocomplete and Text Search", () => {
  assertEquals(
    deepModuleFlags({
      autoCount: 3,
      partnerCount: 3,
      mesitaCount: 3,
      googleCount: 3,
      typesOn: false,
      hasOpenai: true,
    }),
    { wantAuto: false, wantText: false, wantMesita: true },
  );
});

Deno.test("deepModuleFlags: googleCount 0 keeps Autocomplete, skips Text Search", () => {
  assertEquals(
    deepModuleFlags({
      autoCount: 3,
      partnerCount: 3,
      mesitaCount: 3,
      googleCount: 0,
      typesOn: true,
      hasOpenai: true,
    }),
    { wantAuto: true, wantText: false, wantMesita: true },
  );
});

Deno.test("deepModuleFlags: autoCount 0 skips Autocomplete, keeps Text Search", () => {
  assertEquals(
    deepModuleFlags({
      autoCount: 0,
      partnerCount: 3,
      mesitaCount: 3,
      googleCount: 3,
      typesOn: true,
      hasOpenai: true,
    }),
    { wantAuto: false, wantText: true, wantMesita: true },
  );
});

Deno.test("deepModuleFlags: no OpenAI skips Lineup", () => {
  assertEquals(
    deepModuleFlags({
      autoCount: 3,
      partnerCount: 3,
      mesitaCount: 3,
      googleCount: 3,
      typesOn: true,
      hasOpenai: false,
    }),
    { wantAuto: true, wantText: true, wantMesita: false },
  );
});

Deno.test("deepModuleFlags: all lanes on fire all three modules", () => {
  assertEquals(
    deepModuleFlags({
      autoCount: 3,
      partnerCount: 3,
      mesitaCount: 3,
      googleCount: 3,
      typesOn: true,
      hasOpenai: true,
    }),
    { wantAuto: true, wantText: true, wantMesita: true },
  );
});

function listed(
  id: string,
  name: string,
  embedding: number[],
  plan: string | null = "free",
  content_status: string | null = "ready",
): ListedRow {
  return {
    id,
    slug: id,
    google_place_id: `g-${id}`,
    name,
    address: "",
    lat: 19.4,
    lng: -99.1,
    plan,
    content_status,
    enriched_at: null,
    business_status: "OPERATIONAL",
    google_review_count: null,
    name_embedding: embedding,
    embedding: null,
  };
}

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

Deno.test("Word mask never calls randomness · proximity · timing", () => {
  const deep = weightsForMode("word", DISCOVERY_DEFAULTS.weights);
  assertEquals(deep.name > 0, true);
  for (const key of ["randomness", "proximity", "timing", "summary"] as const) {
    assertEquals(deep[key], 0);
  }
  const threw: string[] = [];
  orderDeepLineup([WORSE, BEST], QUERY, deep, undefined);
  assertEquals(threw, []);
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
  assertEquals(src.includes("discoveryRank"), false);
  assertEquals(src.includes("queryNameVector"), true);
  assertEquals(src.includes("queryVector:"), false);
  assertEquals(src.includes("queryVector,"), false);
});

Deno.test("mergeNameDeepQueries: overflow Mesita in Text stays; later Mesita skips it", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [],
    text: [
      item({
        placeId: "overflow",
        mainText: "Resolved overflow",
        mesitaId: "m-overflow",
        status: "web_listed",
      }),
      item({ placeId: "fresh", mainText: "Fresh Google" }),
    ],
    mesita: [
      item({ placeId: "top", mainText: "Top Mesita", mesitaId: "m-top" }),
      item({
        placeId: "overflow",
        mainText: "Should skip",
        mesitaId: "m-overflow",
        status: "web_listed",
      }),
    ],
    partners: [],
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
  // A venue inside a named area still reads as a venue.
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
  const venueA = item({ placeId: "v-a", mainText: "Venue A" });
  const venueB = item({ placeId: "v-b", mainText: "Venue B" });
  const resolvedA = item({
    placeId: "v-a",
    mainText: "Mesita Venue A",
    mesitaId: "m-a",
    status: "web_listed",
  });
  // Venue B died at the gate: only A survived the stamp.
  const out = weaveStampedAutocomplete([venueA, city, venueB], [resolvedA]);
  assertEquals(out.map((p) => p.mainText), ["Mesita Venue A", "Ciudad de México"]);
  assertEquals(out[1].kind, "location");
});

Deno.test("toWire: kind rides Location rows only — venue rows stay byte-identical", () => {
  const venue = toWire(item({ placeId: "v-1", mainText: "Venue" }));
  assertEquals("kind" in venue, false);
  assertEquals("locationType" in venue, false);
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
  // An operator zeroing both Deep counts would otherwise leave Pay's
  // search permanently empty — Search would still have Autocomplete.
  assertEquals(mesitaNameCap({ partnerCount: 0, mesitaCount: 0 }), MESITA_NAME_MIN_CAP);
  assertEquals(mesitaNameCap({ partnerCount: 3, mesitaCount: 3 }), MESITA_NAME_MIN_CAP);
  // Above the floor the operator's number wins, so Pay and Search agree.
  assertEquals(mesitaNameCap({ partnerCount: 40, mesitaCount: 20 }), 60);
  assertEquals(
    mesitaNameCap(DISCOVERY_DEFAULTS.name.deep),
    Math.max(
      DISCOVERY_DEFAULTS.name.deep.partnerCount +
        DISCOVERY_DEFAULTS.name.deep.mesitaCount,
      MESITA_NAME_MIN_CAP,
    ),
  );
});

// deno test supabase/functions/_shared/name-pipeline.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import {
  resolveMode,
  applyResolvedMesitaName,
  classifyPredictionKind,
  deepModuleFlags,
  detailsTargets,
  fetchAutocomplete,
  fetchTextSearch,
  gatedGoogleKind,
  laneDedupeKeys,
  locationTypeOf,
  mergeNameDeepQueries,
  takeFastLane,
  toWire,
  weaveStampedAutocomplete,
  type LaneItem,
} from "./name-pipeline.ts";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import { stripPlacesPrefix } from "./google-places.ts";
import type { GoogleHit } from "./google-listing.ts";

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
      boostTier: 2,
      mesitaId: "m-1",
      mesitaSlug: "mesita-override",
    }),
  );
  assertEquals(out.mainText, "Mesita override");
  assertEquals(out.secondaryText, "Mesita address");
  assertEquals(out.mesitaId, "m-1");
  assertEquals(out.enriched, true);
  // Premier's tier travels with the entity too (MESITA-2925).
  assertEquals(out.boostTier, 2);
});

Deno.test("mergeNameDeepQueries: Autocomplete then Text", () => {
  const out = mergeNameDeepQueries({
    autocomplete: [item({ placeId: "a1", mainText: "Auto" })],
    text: [item({ placeId: "t1", mainText: "Text" })],
  });
  assertEquals(out.map((p) => p.mainText), ["Auto", "Text"]);
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
  });
  assertEquals(out.map((p) => p.mainText), [
    "A1",
    "A2",
    "T1",
    "T2",
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
        placeId: "ChIJ1",
        mainText: "Dup Text",
        mesitaId: "m-1",
        state: "web_listed",
      }),
      item({
        placeId: "ChIJ2",
        mainText: "Resolved Text",
        mesitaId: "m-2",
        state: "web_listed",
      }),
    ],
  });
  assertEquals(out.map((p) => p.mainText), [
    "Resolved Autocomplete",
    "Resolved Text",
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
    googleCount: 3,
  };
  const cases: Array<
    [string, Partial<typeof on>, ReturnType<typeof deepModuleFlags>]
  > = [
    ["googleCount 0 keeps Autocomplete, skips Text Search", { googleCount: 0 }, {
      wantAuto: true,
      wantText: false,
    }],
    ["autoCount 0 skips Autocomplete, keeps Text Search", { autoCount: 0 }, {
      wantAuto: false,
      wantText: true,
    }],
    ["all lanes on fire both modules", {}, {
      wantAuto: true,
      wantText: true,
    }],
  ];
  for (const [label, over, want] of cases) {
    assertEquals(deepModuleFlags({ ...on, ...over }), want, label);
  }
});

Deno.test("Deep source never calls searchNearbyPlaces", async () => {
  const src = await Deno.readTextFile(
    new URL("./name-pipeline.ts", import.meta.url),
  );
  assertEquals(src.includes("searchNearbyPlaces"), false);
  assertEquals(src.includes("applyPlacesCallerRegion"), false);
  assertEquals(src.includes("includedRegionCodes"), false);
  assertEquals(src.includes("rankPlacesSearch"), false);
  assertEquals(src.includes("rankByBlend"), false);
});

// The Mesita Name lane is retired (MESITA-2896): an older client still
// sending `mesita` gets the deep Google lane.
Deno.test("resolveMode: mesita now resolves to deep, unknown still falls back to fast", () => {
  assertEquals(resolveMode("mesita"), "deep");
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

Deno.test("gatedGoogleKind: a non-food Google place is a destination, never a drop", () => {
  // MESITA-2778: "EGADE Business School" used to answer "No matches found".
  const wrongType = { eligible: false, code: "family_not_eligible" };
  assertEquals(gatedGoogleKind({ eligible: true }, true), "place");
  assertEquals(gatedGoogleKind(wrongType, true), "location");
  // The admin caller stays Places-only.
  assertEquals(gatedGoogleKind(wrongType, false), null);
  // A food place under the floors still drops: only the type gate converts.
  assertEquals(gatedGoogleKind({ eligible: false, code: "below_min_rating" }, true), null);
  assertEquals(gatedGoogleKind({ eligible: false, code: "below_min_reviews" }, true), null);
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
  assertEquals(code.includes("runAdminNamePipeline("), true);
  assertEquals(code.includes('"deep"'), true);
  // The engine it left. A comment may name it; the code may not call it.
  assertEquals(code.includes("suggestPlaces"), false);
  // Locations ride the consumer searchbar alone. Absent means false, and the
  // absence IS the assertion — an explicit `true` here would put cities in a
  // list whose every row offers Create.
  assertEquals(code.includes("locations"), false);
});

Deno.test("toWire: Premier's tier rides every row as boost_tier, 0 when absent; no Selected (MESITA-2925)", () => {
  const paid = toWire(item({ placeId: "m", mainText: "Paid", mesitaId: "m1", boostTier: 3 }));
  assertEquals(paid.boost_tier, 3);
  assertEquals("selected" in paid, false);
  assertEquals(toWire(item({ placeId: "g", mainText: "Google" })).boost_tier, 0);
});

Deno.test("toWire: a Text Search card rides Google-only rows, never a Mesita one (MESITA-2325)", () => {
  const card = { id: "g:t1", category_label: "Sports bar", price_level: 2 };
  assertEquals(toWire(item({ placeId: "t1", mainText: "Bar", card })).card, card);
  assertEquals(
    "card" in toWire(item({ placeId: "t1", mainText: "Bar", card, mesitaId: "m1" })),
    false,
  );
  assertEquals("card" in toWire(item({ placeId: "a1", mainText: "Auto" })), false);
});

Deno.test("Text Search asks for the listing mask and builds its card with googleStub", async () => {
  const src = await Deno.readTextFile(new URL("./name-pipeline.ts", import.meta.url));
  const fn = src.slice(src.indexOf("async function fetchTextSearch("));
  assertEquals(fn.includes("fieldMask: LISTING_FIELD_MASK"), true);
  assertEquals(fn.includes("googleHitFromPlace(p)"), true);
  assertEquals(fn.includes("card: googleStub(hit, null)"), true);
});

// ── Google failures never throw out of the lane (MESITA-2855) ───────────────

Deno.test("fetchAutocomplete: a network failure is a google_unreachable envelope, not a throw", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new TypeError("network down"));
  try {
    const res = await fetchAutocomplete("taco", "00000000-0000-4000-8000-000000000000", "k", null);
    assertEquals(res.predictions, []);
    assertEquals(res.errorEnvelope?.code, "google_unreachable");
    assertEquals(res.errorEnvelope?.ok, false);
  } finally {
    globalThis.fetch = orig;
  }
});

Deno.test("fetchAutocomplete: a 200 with an unreadable body is an envelope, not a throw", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("<html>", { status: 200 }));
  try {
    const res = await fetchAutocomplete("taco", "00000000-0000-4000-8000-000000000000", "k", null);
    assertEquals(res.errorEnvelope?.code, "google_unreachable");
  } finally {
    globalThis.fetch = orig;
  }
});

Deno.test("fetchTextSearch: a 200 with an unreadable body is an empty lane, not a throw", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("not json", { status: 200 }));
  try {
    const gate = { ...DISCOVERY_DEFAULTS.map };
    assertEquals(await fetchTextSearch("taco", "k", gate, null, 5), []);
  } finally {
    globalThis.fetch = orig;
  }
});

// Money (MESITA-2881): every id in `fetch` is one billed Place Details call.
Deno.test("detailsTargets reuses paid listings and stops at the lane cap", () => {
  const known = new Map([["B", { placeId: "B" } as GoogleHit]]);
  const out = detailsTargets(["A", "B", "A", "C", "D"], known, 3);
  assertEquals([...out.reused.keys()], ["B"]);
  assertEquals(out.fetch, ["A", "C"]);
  assertEquals(detailsTargets(["A", "B"], undefined, 0).fetch, []);
});

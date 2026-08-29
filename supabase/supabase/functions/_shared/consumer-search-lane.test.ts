// deno test supabase/functions/_shared/consumer-search-lane.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import {
  admitNameFloor,
  applyResolvedMesitaName,
  deepModuleFlags,
  laneDedupeKeys,
  listedNotPartner,
  membershipTone,
  mergeNameDeepLanes,
  orderDeepLineup,
  splitResolvedNameHits,
  stripPlacesPrefix,
  takeFastLane,
  takeNameDeepResults,
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

Deno.test("membershipTone: partner red, listed gray, google-only yellow", () => {
  assertEquals(
    membershipTone({ status: "web_listed", partner: true }),
    "partner",
  );
  assertEquals(
    membershipTone({ status: "web_listed", partner: false }),
    "listed",
  );
  assertEquals(
    membershipTone({ status: "not_in_mesita", partner: true }),
    "google",
  );
  assertEquals(
    membershipTone({ status: "verified_partner_other", partner: true }),
    "partner",
  );
});

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

Deno.test("mergeNameDeepLanes: Partners then Mesita then Google", () => {
  const out = mergeNameDeepLanes({
    partners: [item({ placeId: "p1", mainText: "Partner", partner: true, mesitaId: "m-p" })],
    mesita: [item({ placeId: "m1", mainText: "Mesita", mesitaId: "m-1" })],
    google: [item({ placeId: "g1", mainText: "Google" })],
  });
  assertEquals(out.map((p) => p.mainText), ["Partner", "Mesita", "Google"]);
});

Deno.test("takeNameDeepResults slices the merged list at Max results", () => {
  const merged = mergeNameDeepLanes({
    partners: [
      item({ placeId: "p1", mainText: "P1", partner: true, mesitaId: "m-p1" }),
      item({ placeId: "p2", mainText: "P2", partner: true, mesitaId: "m-p2" }),
    ],
    mesita: [
      item({ placeId: "m1", mainText: "M1", mesitaId: "m-1" }),
      item({ placeId: "m2", mainText: "M2", mesitaId: "m-2" }),
    ],
    google: [
      item({ placeId: "g1", mainText: "G1" }),
      item({ placeId: "g2", mainText: "G2" }),
    ],
  });
  assertEquals(merged.map((p) => p.mainText), ["P1", "P2", "M1", "M2", "G1", "G2"]);
  assertEquals(
    takeNameDeepResults(merged, 4).map((p) => p.mainText),
    ["P1", "P2", "M1", "M2"],
  );
  assertEquals(takeNameDeepResults(merged, 0), []);
});

Deno.test("mergeNameDeepLanes: partner in Mesita lane appears once", () => {
  const out = mergeNameDeepLanes({
    partners: [
      item({
        placeId: "ChIJ1",
        mainText: "Strana",
        partner: true,
        mesitaId: "mesita-1",
        status: "web_listed",
      }),
    ],
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
    google: [],
  });
  assertEquals(out.map((p) => p.mainText), ["Strana", "Listed cafe"]);
});

Deno.test("mergeNameDeepLanes: nested 3+3+3 collapses when Google is already Mesita", () => {
  const partners = [
    item({ placeId: "p1", mainText: "P1", partner: true, mesitaId: "mp1" }),
    item({ placeId: "p2", mainText: "P2", partner: true, mesitaId: "mp2" }),
    item({ placeId: "p3", mainText: "P3", partner: true, mesitaId: "mp3" }),
  ];
  const mesita = [
    ...partners,
    item({ placeId: "m1", mainText: "M1", mesitaId: "mm1" }),
    item({ placeId: "m2", mainText: "M2", mesitaId: "mm2" }),
    item({ placeId: "m3", mainText: "M3", mesitaId: "mm3" }),
  ];
  const google = [
    item({ placeId: "p1", mainText: "P1 stub" }),
    item({ placeId: "m1", mainText: "M1 stub" }),
    item({ placeId: "g1", mainText: "G1" }),
    item({ placeId: "g2", mainText: "G2" }),
    item({ placeId: "g3", mainText: "G3" }),
  ];
  const out = mergeNameDeepLanes({ partners, mesita, google });
  assertEquals(out.map((p) => p.mainText), [
    "P1",
    "P2",
    "P3",
    "M1",
    "M2",
    "M3",
    "G1",
    "G2",
    "G3",
  ]);
});

Deno.test("mergeNameDeepLanes: Google lane keeps Text Search order", () => {
  const out = mergeNameDeepLanes({
    partners: [],
    mesita: [],
    google: [
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
      partnerCount: 3,
      mesitaCount: 3,
      googleCount: 0,
      typesOn: true,
      hasOpenai: true,
    }),
    { wantAuto: true, wantText: false, wantMesita: true },
  );
});

Deno.test("deepModuleFlags: no OpenAI skips Lineup", () => {
  assertEquals(
    deepModuleFlags({
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

Deno.test("Deep mask never calls randomness · proximity · timing", () => {
  const deep = weightsForMode("deep", DISCOVERY_DEFAULTS.weights);
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
  assertEquals(src.includes("rankByBlend"), true);
  assertEquals(src.includes("discoveryRank"), false);
  assertEquals(src.includes("queryNameVector"), true);
  assertEquals(src.includes("queryVector:"), false);
  assertEquals(src.includes("queryVector,"), false);
});

Deno.test("mergeNameDeepLanes: overflow Mesita never stubs as Google", () => {
  const out = mergeNameDeepLanes({
    partners: [],
    mesita: [
      item({ placeId: "top", mainText: "Top Mesita", mesitaId: "m-top" }),
    ],
    google: [
      item({
        placeId: "overflow",
        mainText: "Should not stub",
        mesitaId: "m-overflow",
        status: "web_listed",
      }),
      item({ placeId: "fresh", mainText: "Fresh Google" }),
    ],
  });
  assertEquals(out.map((p) => p.placeId), ["top", "fresh"]);
});

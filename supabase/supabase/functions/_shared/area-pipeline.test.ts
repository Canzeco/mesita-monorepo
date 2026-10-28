import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  type AreaPoolDeps,
  areaSourcesOn,
  parseAreaBounds,
  type PoolRow,
  requestRadiusKm,
  resolveAreaLocation,
  SCREEN_RADIUS_KM_MAX,
  SCREEN_RADIUS_KM_MIN,
  screenRadiusKm,
  selectAreaPool,
  selectedPoolQuery,
  selectMesitaSelected,
} from "./area-pipeline.ts";
import { type AreaSourceKey, DISCOVERY_DEFAULTS, type DiscoveryConfig } from "./discovery-config.ts";
import { nearbyBbox } from "./geo.ts";

const CENTER = { lat: 25.67, lng: -100.3 };

type DepsOver = Partial<AreaPoolDeps<PoolRow>> & {
  /** Shorthands for a point location around CENTER. */
  center?: { lat: number; lng: number } | null;
  radiusKm?: number;
  /** The two switches over the defaults (both on). */
  sources?: Partial<Record<AreaSourceKey, number>>;
  /** The Selected boost over the default (3). */
  weights?: { selectedFactor?: number };
};

function deps(over: DepsOver = {}) {
  const { center = CENTER, radiusKm = 50, sources = {}, weights = {}, cfg: base, ...rest } = over;
  const b = base ?? DISCOVERY_DEFAULTS;
  const cfg: DiscoveryConfig = {
    ...DISCOVERY_DEFAULTS,
    ...b,
    map: { ...b.map, ...sources, ...weights },
  };
  const d: AreaPoolDeps<PoolRow> = {
    surface: "map",
    location: center ? { kind: "point", anchor: center, radiusKm } : { kind: "none" },
    families: [],
    mesitaRows: [],
    cfg,
    ...rest,
  };
  return { d };
}

const ids = (places: Array<Record<string, unknown>>) =>
  places.map((p) => p.id);

// ── Mesita Selected ─────────────────────────────────────────────────────

const ENRICHED = "2026-01-01T00:00:00Z";
function mrow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    lat: CENTER.lat,
    lng: CENTER.lng,
    enriched_at: ENRICHED,
    content_state: "ready",
    // The operator's mark (MESITA-2707): Selected is read here, never off
    // `enriched_at`.
    selected: true,
    family_keys: ["dinner"],
    category: "restaurant",
    google_stars_overall: 4.4,
    google_review_count: 120,
    ...over,
  };
}
const selOpts = {
  center: CENTER,
  radiusKm: 10,
  params: DISCOVERY_DEFAULTS.params,
  surface: "map" as const,
};

Deno.test("selected: only the operator's marked rows inside the radius (MESITA-2707)", () => {
  const out = selectMesitaSelected([
    mrow("ok"),
    // Enriched and ready, but unmarked: Selected is not derived from
    // enrichment any more.
    mrow("unmarked", { selected: false }),
    mrow("far", { lat: CENTER.lat + 1 }),
  ], selOpts);
  assertEquals(ids(out), ["ok"]);
});

Deno.test("selected: a Created place the operator marked is Selected before any Enrich run", () => {
  const out = selectMesitaSelected([
    mrow("created-marked", { enriched_at: null }),
  ], selOpts);
  assertEquals(ids(out), ["created-marked"]);
});

Deno.test("selected: has no review floor — a two-review place is kept", () => {
  const out = selectMesitaSelected([
    mrow("thin", { google_review_count: 2 }),
  ], selOpts);
  assertEquals(ids(out), ["thin"]);
});

Deno.test("selected: the Area score ranks; the nearer twin first", () => {
  const out = selectMesitaSelected([
    mrow("far-twin", { lat: CENTER.lat + 0.02 }),
    mrow("near-twin", { lat: CENTER.lat + 0.001 }),
  ], selOpts);
  assertEquals(ids(out), ["near-twin", "far-twin"]);
  // quiet at 0 km: (1 × 5 + 0.03 × 5) ÷ 10 ≈ 0.51; loved at 1.1 km on a
  // 10 km radius: (0.89 × 5 + 0.95 × 5) ÷ 10 ≈ 0.92.
  const loved = selectMesitaSelected([
    mrow("quiet", { google_stars_overall: 3.1, google_review_count: 5 }),
    mrow("loved", {
      lat: CENTER.lat + 0.01,
      google_stars_overall: 4.9,
      google_review_count: 3000,
    }),
  ], selOpts);
  assertEquals(ids(loved), ["loved", "quiet"]);
});

Deno.test("selected: Chat ranks like the Map, by the radius divisor (MESITA-2687, MESITA-2722)", () => {
  const rows = [
    mrow("near-quiet", { lat: CENTER.lat + 0.001, google_stars_overall: 4.0, google_review_count: 100 }),
    mrow("far-loved", { lat: CENTER.lat + 0.05, google_stars_overall: 4.9, google_review_count: 4000 }),
  ];
  const k = (radiusDivisor: number) => ({ ...selOpts, params: { ...selOpts.params, proximity: { radiusDivisor } } });
  assertEquals(ids(selectMesitaSelected(rows, k(10)))[0], "near-quiet");
  assertEquals(ids(selectMesitaSelected(rows, k(0.5)))[0], "far-loved");
});

Deno.test("selected: a wider circle keeps the same place in", () => {
  // 5.6 km north: inside a 6 km circle and a 60 km one alike; the circle
  // decides who is in (its Proximity follows the radius, MESITA-2720).
  const row = mrow("mid", { lat: CENTER.lat + 0.05 });
  const narrow = selectMesitaSelected([row], { ...selOpts, radiusKm: 6 });
  const wide = selectMesitaSelected([row], { ...selOpts, radiusKm: 60 });
  assertEquals(ids(narrow), ["mid"]);
  assertEquals(ids(wide), ["mid"]);
});

Deno.test("selected: guest families cut, and no centre means no radius", () => {
  const rows = [
    mrow("coffee", { family_keys: ["coffee"], category: "cafe" }),
    mrow("dinner", { lat: CENTER.lat + 5 }),
  ];
  assertEquals(
    ids(selectMesitaSelected(rows, { ...selOpts, families: ["coffee"] })),
    ["coffee"],
  );
  assertEquals(
    new Set(ids(selectMesitaSelected(rows, { ...selOpts, center: null }))),
    new Set(["coffee", "dinner"]),
  );
});

Deno.test("selectedPoolQuery: the Selected mark, General, ready, families and the radius box", () => {
  const seen: string[] = [];
  const q = {
    eq: (c: string, v: unknown) => (seen.push(`eq ${c} ${v}`), q),
    gte: (c: string, v: unknown) => (seen.push(`gte ${c} ${v}`), q),
    lte: (c: string, v: unknown) => (seen.push(`lte ${c} ${v}`), q),
    not: (c: string, op: string, v: unknown) => (seen.push(`not ${c} ${op} ${v}`), q),
    or: (f: string) => (seen.push(`or ${f}`), q),
    overlaps: (c: string, v: string[]) => (seen.push(`overlaps ${c} ${v}`), q),
    order: (c: string, o?: { ascending?: boolean }) => (seen.push(`order ${c} ${o?.ascending}`), q),
  };
  selectedPoolQuery(q, DISCOVERY_DEFAULTS, {
    center: CENTER,
    radiusKm: 5,
    families: ["coffee"],
  });
  // Chat's gate is the operator's mark, never `enriched_at` (MESITA-2707).
  assert(seen.includes("eq selected true"));
  assertEquals(seen.some((s) => s.includes("enriched_at")), false);
  assert(seen.includes("eq content_state ready"));
  assert(seen.includes("overlaps family_keys coffee"));
  assert(seen.some((s) => s.startsWith("gte lat")));
  assertEquals(seen.some((s) => s.includes("google_review_count")), false);
  // A capped pool is the same slice every time (MESITA-2338).
  assertEquals(seen[seen.length - 1], "order id true");
});

Deno.test("the Mesita pool read never carries the reviews floor (MESITA-2702)", () => {
  const seen: string[] = [];
  const q = {
    eq: (c: string, v: unknown) => (seen.push(`eq ${c} ${v}`), q),
    gte: (c: string, v: unknown) => (seen.push(`gte ${c} ${v}`), q),
    lte: (c: string, v: unknown) => (seen.push(`lte ${c} ${v}`), q),
    not: (c: string, op: string, v: unknown) => (seen.push(`not ${c} ${op} ${v}`), q),
    or: (f: string) => (seen.push(`or ${f}`), q),
    overlaps: (c: string, v: string[]) => (seen.push(`overlaps ${c} ${v}`), q),
    order: (c: string, o?: { ascending?: boolean }) => (seen.push(`order ${c} ${o?.ascending}`), q),
  };
  selectedPoolQuery(q, { general: DISCOVERY_DEFAULTS.general }, { center: null, radiusKm: 5 });
  assertEquals(seen.some((s) => s.includes("google_review_count")), false);
});

Deno.test("selected: the radius cut reads the exact distance, not the rounded one", () => {
  // 5.04 km shows as 5.0 km but is outside a 5 km radius.
  const row = {
    id: "edge",
    lat: CENTER.lat + 5.04 / 111.195,
    lng: CENTER.lng,
    enriched_at: "2026-01-01T00:00:00Z",
    content_state: "ready",
    selected: true,
    google_stars_overall: 4.5,
    google_review_count: 100,
    family_keys: ["dinner"],
  };
  assertEquals(
    selectMesitaSelected([row], { ...selOpts, radiusKm: 5 }).length,
    0,
  );
});

Deno.test("Area never embeds: no Area file calls an embedding or a vector signal", async () => {
  for (const file of [
    "./area-pipeline.ts",
    "./area-score.ts",
    "../consumer-web-list-places/index.ts",
    "../consumer-web-list-catalog/index.ts",
  ]) {
    const src = await Deno.readTextFile(new URL(file, import.meta.url));
    for (const banned of ["embedSingle", "embeddings-http", "descriptionSimilarity", "searchNearby", "consumeQuota", "lookupOwned"]) {
      assertEquals(src.includes(banned), false, `${file}: ${banned}`);
    }
  }
});

// ── The pool: Mesita Popularity and Mesita Proximity ────────────────────

Deno.test("pool: the Area score is proximity × popularity; distance breaks ties", async () => {
  // H = radius ÷ 2 (the default divisor): the loved place 1.1 km out beats
  // the quiet one at the centre.
  const out = await selectAreaPool(deps({
    mesitaRows: [
      mrow("near-quiet", { lat: 25.6701, google_stars_overall: 3.0, google_review_count: 110 }),
      mrow("far-loved", { lat: 25.68, google_stars_overall: 4.9, google_review_count: 5000 }),
    ],
  }).d);
  assertEquals(ids(out.places), ["far-loved", "near-quiet"]);
  const tie = await selectAreaPool(deps({
    mesitaRows: [mrow("far", { lat: 25.6705 }), mrow("near", { lat: 25.6702 })],
  }).d);
  assertEquals(ids(tie.places), ["near", "far"]);
});

Deno.test("pool: the Family gate drops a row outside the requested families", async () => {
  const rows = [mrow("a-dinner")];
  assertEquals((await selectAreaPool(deps({ families: ["coffee"], mesitaRows: rows }).d)).places, []);
  assertEquals(ids((await selectAreaPool(deps({ families: [], mesitaRows: rows }).d)).places), ["a-dinner"]);
});

Deno.test("the two switches: on lists them in order", () => {
  const map = DISCOVERY_DEFAULTS.map;
  assertEquals(areaSourcesOn(map), ["mesitaPopular", "mesitaClosest"]);
  assertEquals(areaSourcesOn({ ...map, mesitaClosest: 0 }), ["mesitaPopular"]);
  assertEquals(areaSourcesOn({ ...map, mesitaPopular: 0, mesitaClosest: 0 }), []);
});

Deno.test("merge: a row both sources found is ONE card that remembers both", async () => {
  const out = await selectAreaPool(deps({ mesitaRows: [mrow("m")] }).d);
  assertEquals(ids(out.places), ["m"]);
  assertEquals(out.places[0].area.foundBy, ["mesitaPopular", "mesitaClosest"]);
  assertEquals(out.summary.sources, ["mesitaPopular", "mesitaClosest"]);
  assertEquals(out.summary.sourceCounts, { mesitaPopular: 1, mesitaClosest: 1 });
  // One switch off: only the other finds it.
  const one = await selectAreaPool(deps({ sources: { mesitaPopular: 0 }, mesitaRows: [mrow("m")] }).d);
  assertEquals(one.places[0].area.foundBy, ["mesitaClosest"]);
  assertEquals(one.summary.sourceCounts, { mesitaPopular: 0, mesitaClosest: 1 });
});

Deno.test("every switch off: an empty pool, sources none", async () => {
  const out = await selectAreaPool(deps({
    sources: { mesitaPopular: 0, mesitaClosest: 0 },
    mesitaRows: [mrow("m")],
  }).d);
  assertEquals(out.places, []);
  assertEquals(out.summary.sources, "none");
});

Deno.test("merge: one order, Proximity × Popularity × the Selected boost", async () => {
  const selected = mrow("sel", { lat: 25.6702, google_stars_overall: 4.0, google_review_count: 200 });
  // Enriched, yet unmarked: `source` reads the operator's mark (MESITA-2707).
  const created = mrow("created", { selected: false, lat: 25.6702, google_stars_overall: 4.9, google_review_count: 9000 });
  const run = (selectedFactor: number) =>
    selectAreaPool(deps({ weights: { selectedFactor }, mesitaRows: [selected, created] }).d);
  const out = await run(3);
  const byId = Object.fromEntries(out.places.map((p) => [p.id, p.area]));
  assertEquals(byId["sel"].source, "selected");
  assertEquals(byId["created"].source, "mesita");
  // Only the operator's mark takes the factor (MESITA-2717).
  assertEquals(byId["sel"].selectedFactor, 3);
  assertEquals(byId["created"].selectedFactor, 1);
  for (const a of Object.values(byId)) {
    const want = (a.signals.proximity ?? 0) * (a.signals.popularity ?? 0) * a.selectedFactor;
    assertEquals(Math.abs(a.final - want) < 1e-12, true);
  }
  // × 3 lifts the Selected row over the loved unmarked one; at 1 (off) it does not.
  assert(ids(out.places).indexOf("sel") < ids(out.places).indexOf("created"));
  const off = await run(1);
  assert(ids(off.places).indexOf("created") < ids(off.places).indexOf("sel"));
  const finals = out.places.map((p) => p.area.final);
  assertEquals(finals, [...finals].sort((a, b) => b - a));
});

// Territory is retired (MESITA-2500, MESITA-2603): a point or nothing.
Deno.test("requestRadiusKm: a finite radius is clamped to 1..50 at one decimal; anything else is the operator's", () => {
  for (const raw of [undefined, null, "5", Number.NaN, Number.POSITIVE_INFINITY]) {
    assertEquals(requestRadiusKm(raw, 15), { km: 15, from: "operator" }, String(raw));
  }
  assertEquals(requestRadiusKm(0.3, 15), { km: 1, from: "request" });
  assertEquals(requestRadiusKm(80, 15), { km: 50, from: "request" });
  assertEquals(requestRadiusKm(4.24, 15), { km: 4.2, from: "request" });
  assertEquals(requestRadiusKm(5, 15), { km: 5, from: "request" });
});

Deno.test("parseAreaBounds: valid, inverted, partial and oversized", () => {
  const ok = { low: { lat: 25.6, lng: -100.4 }, high: { lat: 25.7, lng: -100.3 } };
  assertEquals(parseAreaBounds(ok), ok);
  assertEquals(parseAreaBounds({ low: ok.high, high: ok.low }), null);
  assertEquals(parseAreaBounds({ low: ok.low }), null);
  assertEquals(parseAreaBounds({ low: { lat: 0, lng: 0 }, high: { lat: 2, lng: 2 } }), null);
  assertEquals(parseAreaBounds("x"), null);
  // A centre is a point inside the radius; no centre, no location.
  assertEquals(resolveAreaLocation(CENTER, 5), { kind: "point", anchor: CENTER, radiusKm: 5 });
  assertEquals(resolveAreaLocation(null, 5).kind, "none");
});

Deno.test("Mesita Popularity keeps the 20 most popular by raw Popularity; ties by id", async () => {
  const rows = Array.from({ length: 25 }, (_, i) =>
    mrow(`r${String(i).padStart(2, "0")}`, { google_stars_overall: 4.0, google_review_count: 10 + i })
  );
  rows.push(mrow("twin-b", { google_stars_overall: 5, google_review_count: 5000 }));
  rows.push(mrow("twin-a", { google_stars_overall: 5, google_review_count: 5000 }));
  const out = await selectAreaPool(deps({
    sources: { mesitaClosest: 0 },
    mesitaRows: rows,
  }).d);
  assertEquals(out.summary.sourceCounts.mesitaPopular, 20);
  const got = new Set(ids(out.places));
  assertEquals(got.size, 20);
  // The two loved twins and the 18 busiest of the rest; the 7 quietest are out.
  for (const id of ["twin-a", "twin-b", "r24", "r07"]) assert(got.has(id), id);
  for (const id of ["r00", "r06"]) assertEquals(got.has(id), false, id);
});

Deno.test("Mesita Popularity counts a Selected row's Popularity × the Selected boost (MESITA-2717)", async () => {
  // 21 unmarked rows busier than the one Selected row: by raw Popularity it
  // is 22nd and never reaches the pool; × 3 it takes a slot, and leads.
  const rows = Array.from({ length: 21 }, (_, i) =>
    mrow(`r${String(i).padStart(2, "0")}`, { selected: false, google_stars_overall: 4.0, google_review_count: 1000 + i })
  );
  rows.push(mrow("picked", { google_stars_overall: 4.0, google_review_count: 100 }));
  const run = async (selectedFactor: number) =>
    ids((await selectAreaPool(deps({
        sources: { mesitaClosest: 0 },
      weights: { selectedFactor },
      mesitaRows: rows,
    }).d)).places);
  assertEquals((await run(3))[0], "picked");
  assertEquals((await run(1)).includes("picked"), false);
});

Deno.test("Mesita Proximity keeps the 20 nearest; ties by id", async () => {
  const rows = Array.from({ length: 22 }, (_, i) =>
    mrow(`n${String(i).padStart(2, "0")}`, { lat: CENTER.lat + (i + 1) / 1000, google_stars_overall: 5 - i / 10 })
  );
  rows.push(mrow("tie-b", { lat: CENTER.lat + 0.0005 }), mrow("tie-a", { lat: CENTER.lat + 0.0005 }));
  const out = await selectAreaPool(deps({ sources: { mesitaPopular: 0 }, mesitaRows: rows }).d);
  const got = new Set(ids(out.places));
  assertEquals(got.size, 20);
  for (const id of ["tie-a", "tie-b", "n00", "n17"]) assert(got.has(id), id);
  for (const id of ["n18", "n21"]) assertEquals(got.has(id), false, id);
});

Deno.test("no location: Mesita Popularity only, Popularity", async () => {
  const out = await selectAreaPool(deps({ center: null, mesitaRows: [mrow("far", { lat: 40 })] }).d);
  assertEquals(ids(out.places), ["far"]);
  assertEquals(out.places[0].area.formula, "none");
  assertEquals(out.places[0].area.signals.proximity, null);
  assertEquals(out.places[0].area.foundBy, ["mesitaPopular"]);
  assertEquals(out.summary.sources, ["mesitaPopular"]);
  // Mesita Popularity off: nothing can run without a point.
  const off = await selectAreaPool(deps({ center: null, sources: { mesitaPopular: 0 }, mesitaRows: [mrow("far")] }).d);
  assertEquals(off.places, []);
  assertEquals(off.summary.sources, "none");
});

Deno.test("selectedPoolQuery: the Feed and the Map drop the Selected SQL filter; a point reads its radius box", () => {
  const seen: string[] = [];
  const q = {
    eq: (c: string, v: unknown) => (seen.push(`eq ${c} ${v}`), q),
    gte: (c: string, v: unknown) => (seen.push(`gte ${c} ${v}`), q),
    lte: (c: string, v: unknown) => (seen.push(`lte ${c} ${v}`), q),
    not: (c: string, op: string, v: unknown) => (seen.push(`not ${c} ${op} ${v}`), q),
    or: (f: string) => (seen.push(`or ${f}`), q),
    overlaps: (c: string, v: string[]) => (seen.push(`overlaps ${c} ${v}`), q),
    order: (c: string, o?: { ascending?: boolean }) => (seen.push(`order ${c} ${o?.ascending}`), q),
  };
  selectedPoolQuery(q, DISCOVERY_DEFAULTS, {
    center: CENTER,
    radiusKm: 5,
    selectedOnly: false,
  });
  assertEquals(seen.includes("not enriched_at is null"), false);
  assert(seen.includes("eq content_state ready"));
  // The radius box around the point (no rectangle since MESITA-2603).
  const box = nearbyBbox(CENTER.lat, CENTER.lng, 5);
  assert(seen.includes(`gte lat ${box.south}`));
  assert(seen.includes(`lte lng ${box.east}`));
  assertEquals(seen[seen.length - 1], "order id true");
});

Deno.test("list-catalog filters the pool by the row's families (MESITA-2438)", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-list-catalog/index.ts", import.meta.url),
  );
  assert(src.includes("readGuestFamilyKeys(body.familyKeys)"));
  assertEquals(src.includes("families: [],"), false);
});

Deno.test("a family row ranks by score alone: no family is primary (MESITA-2808)", async () => {
  // A cafe and a taqueria that serve breakfast are as Breakfast as a brunch spot.
  const { places } = await selectAreaPool(deps({
    families: ["breakfast"],
    mesitaRows: [
      mrow("cafe", { lat: 25.6701, family_keys: ["coffee", "breakfast"], google_stars_overall: 5, google_review_count: 5000 }),
      mrow("brunch", { lat: 25.6702, family_keys: ["breakfast"], google_stars_overall: 3.5, google_review_count: 120 }),
      mrow("tacos", { lat: 25.6703, family_keys: ["tacos", "breakfast"], google_stars_overall: 4.9, google_review_count: 4000 }),
    ],
  }).d);
  assertEquals(ids(places), ["cafe", "tacos", "brunch"]);
  assertEquals("primaryFamily" in places[0].area, false);
});

// ── The Map's screen radius (MESITA-2504) ───────────────────────────────

Deno.test("screen radius: 0.9 of the cross's distance to the nearest edge, so it fits (MESITA-2511, MESITA-2825)", () => {
  // A tall phone screen (0.06° tall ≈ 6.67 km, 0.02° wide ≈ 2.004 km): the
  // half-width is the nearest edge.
  const tall = screenRadiusKm({
    low: { lat: 25.64, lng: -100.31 },
    high: { lat: 25.7, lng: -100.29 },
  })!;
  assert(Math.abs(tall - 0.9 * 2.004 / 2) < 0.01, String(tall));
  // A wide screen (0.02° tall ≈ 2.224 km, 0.06° wide ≈ 6.01 km): the
  // height wins, measured from the middle when no cross is sent.
  const wide = screenRadiusKm({
    low: { lat: 25.66, lng: -100.33 },
    high: { lat: 25.68, lng: -100.27 },
  })!;
  assert(Math.abs(wide - 0.9 * 2.224 / 2) < 0.01, String(wide));
  // The cross 45% down: its nearer edge is the top, 0.45 × 2.224 km.
  const cross = { lat: 25.68 - 0.02 * 0.45, lng: -100.3 };
  const sight = screenRadiusKm({
    low: { lat: 25.66, lng: -100.33 },
    high: { lat: 25.68, lng: -100.27 },
  }, cross)!;
  assert(Math.abs(sight - 0.9 * 0.45 * 2.224) < 0.01, String(sight));
  // A cross off the box is ignored: the middle is used.
  const off = screenRadiusKm({
    low: { lat: 25.66, lng: -100.33 },
    high: { lat: 25.68, lng: -100.27 },
  }, { lat: 26, lng: -100.3 })!;
  assert(Math.abs(off - wide) < 1e-9, String(off));
});

Deno.test("screen radius: no readable screen is null; a tiny screen is clamped", () => {
  assertEquals(screenRadiusKm(null), null);
  assertEquals(screenRadiusKm({ low: { lat: 1, lng: 1 }, high: { lat: 0, lng: 2 } }), null);
  assertEquals(screenRadiusKm({ low: { lat: 0, lng: 0 }, high: { lat: 2, lng: 2 } }), null);
  const tiny = screenRadiusKm({
    low: { lat: 25.67, lng: -100.3 },
    high: { lat: 25.67001, lng: -100.29999 },
  });
  assertEquals(tiny, SCREEN_RADIUS_KM_MIN);
  assertEquals(SCREEN_RADIUS_KM_MAX, 50);
});

Deno.test("screen radius: the circle gates the pool and sets Proximity's half distance, Proximity × Popularity", async () => {
  // 1 km circle: inside at ~0.56 km, outside at ~1.67 km.
  const out = await selectAreaPool(deps({
    radiusKm: 1,
    mesitaRows: [mrow("inside", { lat: 25.675 }), mrow("outside", { lat: 25.685 })],
  }).d);
  assertEquals(ids(out.places), ["inside"]);
  const a = out.places[0].area;
  // H = 1 km ÷ 2: 1 ÷ (1 + 0.556 ÷ 0.5), a tight screen still sorts by
  // distance (MESITA-2720).
  assert(Math.abs((a.signals.proximity ?? 0) - 1 / (1 + 0.556 / 0.5)) < 0.01, String(a.signals.proximity));
  // final = proximity × popularity × the Selected boost (no exponents, MESITA-2722).
  const want = (a.signals.proximity ?? 0) * (a.signals.popularity ?? 0) * a.selectedFactor;
  assert(Math.abs(a.final - want) < 1e-9);
});


Deno.test("the pool keeps the top map.placesShown of the sorted merge (MESITA-2713)", async () => {
  // 30 Mesita rows, one per review count, all at the centre: Mesita Popularity
  // and Mesita Proximity bring 20 each, merged to 30 distinct places at most.
  const rows = Array.from({ length: 30 }, (_, i) => mrow(`m${String(i).padStart(2, "0")}`, { google_review_count: 10 + i }));
  const run = async (placesShown?: number) => {
    const { d } = deps({ mesitaRows: rows });
    if (placesShown !== undefined) d.cfg = { ...d.cfg, map: { ...d.cfg.map, placesShown } };
    return (await selectAreaPool(d)).places;
  };
  const top5 = await run(5);
  assertEquals(top5.length, 5);
  // The cut keeps the best: the five highest review counts.
  assertEquals(ids(top5), ["m29", "m28", "m27", "m26", "m25"]);
  assertEquals((await run()).length, 20);
  assertEquals((await run(40)).length, 30);
});

Deno.test("Map and Catalog cut with their own Places shown, rank with ONE penalty (MESITA-2727, MESITA-2776)", async () => {
  const rows = Array.from({ length: 30 }, (_, i) => mrow(`m${String(i).padStart(2, "0")}`, { google_review_count: 10 + i }));
  const run = async (surface: "map" | "catalog") => {
    const { d } = deps({ mesitaRows: rows, surface });
    d.cfg = {
      ...d.cfg,
      map: { ...d.cfg.map, placesShown: 5, catalogPlacesShown: 12 },
      // A stale stored Catalog penalty is ignored: one number ranks both.
      params: { ...d.cfg.params, proximity: { radiusDivisor: 4, catalogRadiusDivisor: 0.5 } as { radiusDivisor: number } },
    };
    return await selectAreaPool(d);
  };
  const map = await run("map");
  const home = await run("catalog");
  assertEquals(map.places.length, 5);
  assertEquals(home.places.length, 12);
  assertEquals([map.summary.surface, map.summary.distancePenalty, map.summary.placesShown], ["map", 4, 5]);
  assertEquals([home.summary.surface, home.summary.distancePenalty, home.summary.placesShown], ["catalog", 4, 12]);
});

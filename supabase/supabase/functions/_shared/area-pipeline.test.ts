import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  type AreaPoolDeps,
  catalogPageSize,
  parseAreaBounds,
  type PoolRow,
  resolveAreaLocation,
  SCREEN_RADIUS_KM_MIN,
  screenRadiusKm,
  mesitaPoolQuery,
  rankMesitaPlaces,
  selectAreaPool,
} from "./area-pipeline.ts";
import { DISCOVERY_DEFAULTS, type DiscoveryConfig } from "./discovery-config.ts";
import { nearbyBbox } from "./geo.ts";

const CENTER = { lat: 25.67, lng: -100.3 };

type DepsOver = Partial<AreaPoolDeps<PoolRow>> & {
  /** Shorthands for a point location around CENTER. */
  center?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
};

function deps(over: DepsOver = {}) {
  const { center = CENTER, radiusKm = 50, cfg: base, ...rest } = over;
  const b = base ?? DISCOVERY_DEFAULTS;
  const cfg: DiscoveryConfig = { ...DISCOVERY_DEFAULTS, ...b };
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

// ── Chat's Mesita read (every ready place since MESITA-2925) ────────────

const ENRICHED = "2026-01-01T00:00:00Z";
function mrow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    lat: CENTER.lat,
    lng: CENTER.lng,
    enriched_at: ENRICHED,
    content_state: "ready",
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
};

Deno.test("chat: every ready row inside the radius, a stale Selected mark ignored (MESITA-2925)", () => {
  const out = rankMesitaPlaces([
    mrow("ok"),
    mrow("unmarked", { selected: false }),
    mrow("created", { enriched_at: null }),
    mrow("far", { lat: CENTER.lat + 1 }),
  ], selOpts);
  assertEquals(new Set(ids(out)), new Set(["ok", "unmarked", "created"]));
});

Deno.test("chat: a Premier place outranks a plain twin by its tier (MESITA-2925)", () => {
  const out = rankMesitaPlaces([
    mrow("plain", { google_review_count: 400 }),
    mrow("premier", { google_review_count: 120, boost_tier: 1 }),
  ], selOpts);
  assertEquals(ids(out), ["premier", "plain"]);
});

Deno.test("chat: has no review floor — a two-review place is kept", () => {
  const out = rankMesitaPlaces([
    mrow("thin", { google_review_count: 2 }),
  ], selOpts);
  assertEquals(ids(out), ["thin"]);
});

Deno.test("chat: the Catalog score ranks; the nearer twin first", () => {
  const out = rankMesitaPlaces([
    mrow("far-twin", { lat: CENTER.lat + 0.02 }),
    mrow("near-twin", { lat: CENTER.lat + 0.001 }),
  ], selOpts);
  assertEquals(ids(out), ["near-twin", "far-twin"]);
  // quiet at 0 km: 1 × ln(1 + 15.5) ≈ 2.8; loved at 1.1 km, h = 5 km:
  // 0.76 × ln(1 + 14,700) ≈ 7.3.
  const loved = rankMesitaPlaces([
    mrow("quiet", { google_stars_overall: 3.1, google_review_count: 5 }),
    mrow("loved", {
      lat: CENTER.lat + 0.01,
      google_stars_overall: 4.9,
      google_review_count: 3000,
    }),
  ], selOpts);
  assertEquals(ids(loved), ["loved", "quiet"]);
});

Deno.test("chat: Chat ranks like the Catalog, by the half distance (MESITA-2909)", () => {
  const rows = [
    mrow("near-quiet", { lat: CENTER.lat + 0.001, google_stars_overall: 4.0, google_review_count: 100 }),
    mrow("far-loved", { lat: CENTER.lat + 0.05, google_stars_overall: 4.9, google_review_count: 4000 }),
  ];
  const h = (halfKm: number) => ({ ...selOpts, params: { ...selOpts.params, proximity: { halfKm } } });
  assertEquals(ids(rankMesitaPlaces(rows, h(0.5)))[0], "near-quiet");
  assertEquals(ids(rankMesitaPlaces(rows, h(50)))[0], "far-loved");
});

Deno.test("chat: a wider circle keeps the same place in", () => {
  // 5.6 km north: inside a 6 km circle and a 60 km one alike; the circle
  // decides who is in (its Proximity follows the radius, MESITA-2720).
  const row = mrow("mid", { lat: CENTER.lat + 0.05 });
  const narrow = rankMesitaPlaces([row], { ...selOpts, radiusKm: 6 });
  const wide = rankMesitaPlaces([row], { ...selOpts, radiusKm: 60 });
  assertEquals(ids(narrow), ["mid"]);
  assertEquals(ids(wide), ["mid"]);
});

Deno.test("chat: guest families cut, and no centre means no radius", () => {
  const rows = [
    mrow("coffee", { family_keys: ["coffee"], category: "cafe" }),
    mrow("dinner", { lat: CENTER.lat + 5 }),
  ];
  assertEquals(
    ids(rankMesitaPlaces(rows, { ...selOpts, families: ["coffee"] })),
    ["coffee"],
  );
  assertEquals(
    new Set(ids(rankMesitaPlaces(rows, { ...selOpts, center: null }))),
    new Set(["coffee", "dinner"]),
  );
});

Deno.test("mesitaPoolQuery: General, ready, families and the radius box; no Selected cut (MESITA-2925)", () => {
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
  mesitaPoolQuery(q, DISCOVERY_DEFAULTS, {
    center: CENTER,
    radiusKm: 5,
    families: ["coffee"],
  });
  // Selected is read by no one (MESITA-2925).
  assertEquals(seen.some((s) => s.includes("selected")), false);
  assertEquals(seen.some((s) => s.includes("enriched_at")), false);
  assert(seen.includes("eq content_state ready"));
  assert(seen.includes("overlaps family_keys coffee"));
  assert(seen.some((s) => s.startsWith("gte lat")));
  assertEquals(seen.some((s) => s.includes("google_review_count")), false);
  // A capped pool is the same slice every time (MESITA-2338).
  assertEquals(seen[seen.length - 1], "order id true");
  // The Catalog passes no centre: no box at all (MESITA-2909).
  seen.length = 0;
  mesitaPoolQuery(q, DISCOVERY_DEFAULTS, { center: null, radiusKm: 0 });
  assertEquals(seen.some((l) => l.startsWith("gte lat") || l.startsWith("lte lng")), false);
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
  mesitaPoolQuery(q, { general: DISCOVERY_DEFAULTS.general }, { center: null, radiusKm: 5 });
  assertEquals(seen.some((s) => s.includes("google_review_count")), false);
});

Deno.test("chat: the radius cut reads the exact distance, not the rounded one", () => {
  // 5.04 km shows as 5.0 km but is outside a 5 km radius.
  const row = {
    id: "edge",
    lat: CENTER.lat + 5.04 / 111.195,
    lng: CENTER.lng,
    enriched_at: "2026-01-01T00:00:00Z",
    content_state: "ready",
    google_stars_overall: 4.5,
    google_review_count: 100,
    family_keys: ["dinner"],
  };
  assertEquals(
    rankMesitaPlaces([row], { ...selOpts, radiusKm: 5 }).length,
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

Deno.test("the Map: Popularity alone orders the circle; distance breaks ties (MESITA-2909)", async () => {
  const out = await selectAreaPool(deps({
    mesitaRows: [
      mrow("near-quiet", { lat: 25.6701, google_stars_overall: 3.0, google_review_count: 110 }),
      mrow("far-loved", { lat: 25.9, google_stars_overall: 4.9, google_review_count: 5000 }),
    ],
  }).d);
  assertEquals(ids(out.places), ["far-loved", "near-quiet"]);
  assertEquals(out.places[0].area.signals.proximity, null);
  assertEquals(out.places[0].area.halfKm, null);
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

Deno.test("the Catalog: every place, no radius, Proximity × Popularity × the Premier factor (MESITA-2909, MESITA-2925)", async () => {
  const premier = mrow("off", { lat: 25.6702, google_stars_overall: 4.0, google_review_count: 200 });
  // A stale Selected mark scores nothing (MESITA-2925).
  const plain = mrow("plain", { selected: true, lat: 25.6702, google_stars_overall: 4.9, google_review_count: 9000 });
  // 330 km away: kept, only lowered.
  const far = mrow("far", { lat: 28.6, google_stars_overall: 4.9, google_review_count: 9000 });
  const run = (tier: number) =>
    selectAreaPool(deps({ surface: "catalog", radiusKm: null, mesitaRows: [{ ...premier, boost_tier: tier }, plain, far] }).d);
  const out = await run(3);
  const byId = Object.fromEntries(out.places.map((p) => [p.id, p.area]));
  assertEquals(ids(out.places).length, 3);
  assertEquals(byId["far"].gates.radius, null);
  assertEquals(byId["off"].selectedFactor, 10);
  assertEquals(byId["plain"].selectedFactor, 1);
  for (const a of Object.values(byId)) {
    assertEquals(a.halfKm, 1);
    const want = (a.signals.proximity ?? 0) * (a.signals.popularity ?? 0) * a.selectedFactor;
    assertEquals(Math.abs(a.final - want) < 1e-12, true);
  }
  assertEquals(ids(out.places)[2], "far");
  // Premier 10X lifts the quieter row over the loved plain one; tier 0 does not.
  assert(ids(out.places).indexOf("off") < ids(out.places).indexOf("plain"));
  const none = await run(0);
  assert(ids(none.places).indexOf("plain") < ids(none.places).indexOf("off"));
  const finals = out.places.map((p) => p.area.final);
  assertEquals(finals, [...finals].sort((a, b) => b - a));
});

// Territory is retired (MESITA-2500, MESITA-2603): a point or nothing.
Deno.test("parseAreaBounds: valid, inverted, partial and any size", () => {
  const ok = { low: { lat: 25.6, lng: -100.4 }, high: { lat: 25.7, lng: -100.3 } };
  assertEquals(parseAreaBounds(ok), ok);
  assertEquals(parseAreaBounds({ low: ok.high, high: ok.low }), null);
  assertEquals(parseAreaBounds({ low: ok.low }), null);
  // Any size is read (MESITA-2918): a state-wide map is still a screen.
  const wide = { low: { lat: 0, lng: 0 }, high: { lat: 2, lng: 2 } };
  assertEquals(parseAreaBounds(wide), wide);
  assertEquals(parseAreaBounds("x"), null);
  // A centre is a point, gated by a radius or not (the Catalog); no centre, no location.
  assertEquals(resolveAreaLocation(CENTER, 5), { kind: "point", anchor: CENTER, radiusKm: 5 });
  assertEquals(resolveAreaLocation(CENTER, null), { kind: "point", anchor: CENTER, radiusKm: null });
  assertEquals(resolveAreaLocation(null, 5).kind, "none");
});

Deno.test("no location: Popularity alone", async () => {
  const out = await selectAreaPool(deps({ center: null, surface: "catalog", mesitaRows: [mrow("far", { lat: 40 })] }).d);
  assertEquals(ids(out.places), ["far"]);
  assertEquals(out.places[0].area.formula, "none");
  assertEquals(out.places[0].area.signals.proximity, null);
});

Deno.test("mesitaPoolQuery: a point reads its radius box, none reads everything", () => {
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
  mesitaPoolQuery(q, DISCOVERY_DEFAULTS, {
    center: CENTER,
    radiusKm: 5,
  });
  assertEquals(seen.includes("not enriched_at is null"), false);
  assert(seen.includes("eq content_state ready"));
  // The radius box around the point (no rectangle since MESITA-2603).
  const box = nearbyBbox(CENTER.lat, CENTER.lng, 5);
  assert(seen.includes(`gte lat ${box.south}`));
  assert(seen.includes(`lte lng ${box.east}`));
  assertEquals(seen[seen.length - 1], "order id true");
  // The Catalog passes no centre: no box at all (MESITA-2909).
  seen.length = 0;
  mesitaPoolQuery(q, DISCOVERY_DEFAULTS, { center: null, radiusKm: 0 });
  assertEquals(seen.some((l) => l.startsWith("gte lat") || l.startsWith("lte lng")), false);
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

Deno.test("screen radius: no readable screen is null; a tiny screen is floored; a huge one is not capped (MESITA-2918)", () => {
  assertEquals(screenRadiusKm(null), null);
  assertEquals(screenRadiusKm({ low: { lat: 1, lng: 1 }, high: { lat: 0, lng: 2 } }), null);
  // Pato's Nuevo León screenshot: ~4° tall, ~3.6° wide around Monterrey.
  const state = screenRadiusKm({
    low: { lat: 23.6, lng: -102.1 },
    high: { lat: 27.6, lng: -98.5 },
  }, { lat: 25.7, lng: -100.3 })!;
  assert(state > 150 && state < 200, String(state));
  const tiny = screenRadiusKm({
    low: { lat: 25.67, lng: -100.3 },
    high: { lat: 25.67001, lng: -100.29999 },
  });
  assertEquals(tiny, SCREEN_RADIUS_KM_MIN);
});

Deno.test("screen radius: the circle gates the Map's pool and never scores (MESITA-2909)", async () => {
  // 1 km circle: inside at ~0.56 km, outside at ~1.67 km.
  const out = await selectAreaPool(deps({
    radiusKm: 1,
    mesitaRows: [mrow("inside", { lat: 25.675 }), mrow("outside", { lat: 25.685 })],
  }).d);
  assertEquals(ids(out.places), ["inside"]);
  const a = out.places[0].area;
  assertEquals(a.signals.proximity, null);
  // final = popularity × the Premier factor.
  assert(Math.abs(a.final - (a.signals.popularity ?? 0) * a.selectedFactor) < 1e-9);
});


Deno.test("the Map keeps its top map.placesShown; the Catalog keeps all and sends its page size (MESITA-2713, MESITA-2909)", async () => {
  const rows = Array.from({ length: 80 }, (_, i) => mrow(`m${String(i).padStart(2, "0")}`, { google_review_count: 10 + i }));
  const run = async (surface: "map" | "catalog", map: Partial<DiscoveryConfig["map"]> = {}) => {
    const { d } = deps({ mesitaRows: rows, surface, radiusKm: surface === "map" ? 50 : null });
    d.cfg = { ...d.cfg, map: { ...d.cfg.map, ...map } };
    return await selectAreaPool(d);
  };
  const top5 = await run("map", { placesShown: 5 });
  // The cut keeps the best: the five highest review counts.
  assertEquals(ids(top5.places), ["m79", "m78", "m77", "m76", "m75"]);
  assertEquals((await run("map")).places.length, 50);
  const home = await run("catalog", { placesShown: 5, catalogPageSize: 12 });
  assertEquals(home.places.length, 80);
  assertEquals([home.summary.surface, home.summary.halfKm, home.summary.pageSize, home.summary.placesShown], ["catalog", 1, 12, null]);
  assertEquals([top5.summary.surface, top5.summary.halfKm, top5.summary.pageSize, top5.summary.placesShown], ["map", null, null, 5]);
  assertEquals(catalogPageSize({}), 20);
});

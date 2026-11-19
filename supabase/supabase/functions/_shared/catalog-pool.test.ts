// The Map's two-pass read (MESITA-2950): walk every gated row's scoring
// columns by id, rank them all, keep the top, then read only those cards.
// The Catalog ranks in SQL (`catalog_rank_lanes`, MESITA-3059, MESITA-4454)
// and reads only its first page's cards; `order` carries every ranked id
// (MESITA-3057), the two lanes merged and the first page shuffled. A fake
// PostgREST builder and a fake rank stand in for the database.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  CATALOG_SCAN_PAGE,
  CATALOG_SCORING_COLUMNS,
  catalogNearestArgs,
  catalogRankLanesArgs,
  type CatalogRankRpc,
  CatalogReadError,
  type PoolBuilder,
  type PoolRow,
  resolveAreaLocation,
  selectCatalogPool,
  selectMapPool,
  walkScoringRows,
} from "./area-pipeline.ts";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import { PREMIER_FACTOR } from "./boost.ts";
import { readRankMode, readSeedPoint, readShuffleSeed } from "./catalog-request.ts";

const CENTER = { lat: 25.67, lng: -100.3 };
const CARDS = "id,name,lat,lng";

/** Zero-padded ids sort like the uuids Postgres orders by. */
const pid = (n: number) => `p${String(n).padStart(5, "0")}`;

function row(n: number, over: Record<string, unknown> = {}): PoolRow {
  return {
    id: pid(n),
    name: `Place ${n}`,
    lat: CENTER.lat,
    lng: CENTER.lng,
    google_stars_overall: 4,
    google_review_count: 10,
    family_keys: ["dinner"],
    boost_tier: 0,
    ...over,
  } as PoolRow;
}

type Fail = { pass: 1 | 2; at: number };

/** Every read this fake served, in order. */
type Seen = { columns: string; gt: string | null; in: string[] | null; limit: number; bbox: boolean };

function fakeRead(rows: PoolRow[], opts: { fail?: Fail; dropFromCards?: string[] } = {}) {
  const sorted = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const seen: Seen[] = [];
  let scanPage = 0;
  let cardChunk = 0;
  const read = (columns: string): PoolBuilder => {
    const s: Seen = { columns, gt: null, in: null, limit: 0, bbox: false };
    const b = {
      eq: () => b,
      gte: () => {
        s.bbox = true;
        return b;
      },
      lte: () => b,
      or: () => b,
      not: () => b,
      overlaps: () => b,
      order: () => b,
      gt: (_col: string, val: unknown) => {
        s.gt = String(val);
        return b;
      },
      in: (_col: string, vals: readonly unknown[]) => {
        s.in = vals.map(String);
        return b;
      },
      limit: (n: number) => {
        s.limit = n;
        seen.push(s);
        const pass = columns === CATALOG_SCORING_COLUMNS ? 1 : 2;
        const at = pass === 1 ? scanPage++ : cardChunk++;
        if (opts.fail && opts.fail.pass === pass && opts.fail.at === at) {
          return Promise.resolve({ data: null, error: { message: "boom: relation detail", code: "57014" } });
        }
        let out = sorted;
        if (s.gt !== null) out = out.filter((r) => String(r.id) > s.gt!);
        if (s.in !== null) {
          const want = new Set(s.in.filter((id) => !(opts.dropFromCards ?? []).includes(id)));
          out = out.filter((r) => want.has(String(r.id)));
        }
        return Promise.resolve({ data: out.slice(0, n), error: null });
      },
    } as unknown as PoolBuilder;
    return b;
  };
  return { read, seen };
}

const wire = (rows: unknown[]) => rows as PoolRow[];

/** A fake `catalog_rank` and `catalog_rank_lanes`: each answers this order
 *  (the lanes add `premier`) or an error, and records its arguments. */
function fakeRank(order: string[], opts: { fail?: boolean; read?: number; premier?: string[] } = {}) {
  const calls: Record<string, unknown>[] = [];
  const lanesCalls: Record<string, unknown>[] = [];
  const fail = { data: null, error: { message: "boom: relation detail", code: "57014" } };
  const rank: CatalogRankRpc = (args) => {
    calls.push(args);
    return Promise.resolve(opts.fail ? fail : { data: { read: opts.read ?? order.length, ids: order }, error: null });
  };
  const rankLanes: CatalogRankRpc = (args) => {
    lanesCalls.push(args);
    return Promise.resolve(
      opts.fail ? fail : {
        data: {
          read: opts.read ?? order.length,
          ids: order,
          premier: opts.premier ?? [],
          below_floor: 2,
          inorganic_total: (opts.premier ?? []).length + 2,
        },
        error: null,
      },
    );
  };
  return { rank, rankLanes, calls, lanesCalls };
}

function pool(
  rows: PoolRow[],
  order: string[],
  opts: Parameters<typeof fakeRead>[1] & {
    pageSize?: number;
    failRank?: boolean;
    temperature?: number;
    nearest?: boolean;
    premier?: string[];
    adEvery?: number;
    seed?: number;
  } = {},
) {
  const fake = fakeRead(rows, opts);
  const ranker = fakeRank(order, { fail: opts.failRank, premier: opts.premier });
  // The shuffle is off unless a test asks for it (MESITA-4153), so the
  // fake rank's order is the order the pool keeps.
  const t = opts.temperature ?? 0;
  const cfg = {
    ...DISCOVERY_DEFAULTS,
    params: {
      ...DISCOVERY_DEFAULTS.params,
      mix: {
        ...DISCOVERY_DEFAULTS.params.mix,
        temperature: { nearby: t, family: t, popular: t },
        adEvery: opts.adEvery ?? 1,
      },
    },
  };
  const run = selectCatalogPool({
    rank: ranker.rank,
    rankLanes: ranker.rankLanes,
    read: fake.read,
    cfg,
    nearest: opts.nearest,
    mode: "popular",
    seed: opts.seed ?? 7,
    location: resolveAreaLocation(CENTER, null),
    families: [],
    cardColumns: CARDS,
    wire,
    pageSize: opts.pageSize ?? 100,
  });
  return { run, seen: fake.seen, calls: ranker.calls, lanesCalls: ranker.lanesCalls };
}

Deno.test("walkScoringRows: 2,500 rows, every id once, keyset by the last id, stops on an empty page", async () => {
  const rows = Array.from({ length: 2500 }, (_, i) => row(i));
  const { read, seen } = fakeRead(rows);
  const walk = await walkScoringRows(read, DISCOVERY_DEFAULTS, { families: [] });
  assertEquals(walk.rows.length, 2500);
  assertEquals(new Set(walk.rows.map((r) => r.id)).size, 2500);
  assertEquals(walk.scanCapped, false);
  // Three full-or-short pages, then the empty one that ends the walk.
  assertEquals(seen.map((s) => s.gt), [null, pid(999), pid(1999), pid(2499)]);
  for (const s of seen) {
    assertEquals(s.columns, CATALOG_SCORING_COLUMNS);
    assertEquals(s.limit, CATALOG_SCAN_PAGE);
    // No centre, no box: the whole catalog.
    assertEquals(s.bbox, false);
  }
});

Deno.test("walkScoringRows: full pages up to the cap set scanCapped and stop", async () => {
  const rows = Array.from({ length: 2500 }, (_, i) => row(i));
  const { read, seen } = fakeRead(rows);
  const walk = await walkScoringRows(read, DISCOVERY_DEFAULTS, { families: [] }, 2);
  assertEquals(walk.rows.length, 2000);
  assertEquals(walk.scanCapped, true);
  assertEquals(walk.lastId, pid(1999));
  assertEquals(seen.length, 2);
});

Deno.test("the Catalog never walks: one SQL rank, then only the first page's cards (MESITA-3059)", async () => {
  // 1,250 places, past any page; the SQL order is the answer's order.
  const rows = Array.from({ length: 1250 }, (_, i) => row(i, { google_review_count: 10 + i }));
  const order = rows.map((r) => r.id).reverse();
  const { run, seen, calls, lanesCalls } = pool(rows, order, { pageSize: 100 });
  const out = await run;
  assertEquals([lanesCalls.length, calls.length], [1, 0]);
  // No scoring-column walk at all, so no 10,000-row cap.
  assertEquals(seen.filter((s) => s.columns === CATALOG_SCORING_COLUMNS).length, 0);
  const asked = seen.filter((s) => s.columns === CARDS).flatMap((s) => s.in ?? []);
  assertEquals(asked, order.slice(0, 100));
  assertEquals(out.order, order);
  assertEquals(out.places.map((p) => p.id), order.slice(0, 100));
  // Each card carries its breakdown, scored from the same point.
  // The Popular Organic row's half distance (MESITA-4454).
  assertEquals(out.places[0].area.halfKm, 10);
  assertEquals(out.places[0].name, "Place 1249");
  assertEquals(
    [out.summary.read, out.summary.total, out.summary.returned, out.summary.chunks, out.summary.missing],
    [1250, 1250, 100, 1, 0],
  );
  assertEquals(out.summary.surface, "catalog");
});

Deno.test("catalog_rank_lanes' arguments are the mode's two recipe rows, the gates and the mix (MESITA-4454)", () => {
  const cfg = DISCOVERY_DEFAULTS;
  const near = catalogRankLanesArgs(cfg, resolveAreaLocation(CENTER, null), ["dinner"], "nearby");
  assertEquals([near.p_lat, near.p_lng], [CENTER.lat, CENTER.lng]);
  assertEquals([near.p_premier_1, near.p_premier_2], [PREMIER_FACTOR[1], PREMIER_FACTOR[2]]);
  assertEquals(near.p_families, ["dinner"]);
  assert((near.p_known_families as string[]).includes("dinner"));
  assertEquals((near.p_known_families as string[]).includes("undefined"), false);
  assertEquals(near.p_require_active, cfg.general.requireActive);
  const o = cfg.params.recipes.catalogNearbyOrganic;
  const i = cfg.params.recipes.catalogNearbyInorganic;
  assertEquals(
    [near.p_organic_half_km, near.p_organic_distance_exp, near.p_organic_stars_exp, near.p_organic_google_exp, near.p_organic_premier_exp],
    [o.halfKm, o.distanceExp, o.starsExp, o.googleExp, 0],
  );
  assertEquals(
    [near.p_ad_half_km, near.p_ad_distance_exp, near.p_ad_stars_exp, near.p_ad_google_exp, near.p_ad_premier_exp],
    [i.halfKm, i.distanceExp, i.starsExp, i.googleExp, i.premierExp],
  );
  assertEquals(near.p_ad_floor, cfg.params.mix.adFloor);
  // Nearby sends repeat 1, hard-coded (E5); Family and Popular send the penalty.
  assertEquals(near.p_repeat, 1);
  const popular = catalogRankLanesArgs(cfg, resolveAreaLocation(null, null), [], "popular");
  assertEquals([popular.p_lat, popular.p_lng], [null, null]);
  assertEquals(popular.p_repeat, cfg.params.variety.repeat);
  assertEquals(popular.p_organic_half_km, cfg.params.recipes.catalogPopularOrganic.halfKm);
  assertEquals(
    catalogRankLanesArgs(cfg, resolveAreaLocation(CENTER, null), ["tacos"], "family").p_organic_half_km,
    cfg.params.recipes.catalogFamilyOrganic.halfKm,
  );
  // `nearest` keeps catalog_rank's old arguments: distance alone, no variety.
  const nearest = catalogNearestArgs(cfg, resolveAreaLocation(CENTER, null), []);
  assertEquals([nearest.p_nearest, nearest.p_repeat], [true, 1]);
  for (const k of ["p_half_km", "p_exponent", "p_root", "p_stars_power"]) assert(k in nearest, k);
});

Deno.test("the shuffle after the merge: same ids, a new first page, never for nearest", async () => {
  const rows = Array.from({ length: 60 }, (_, i) => row(i));
  const order = rows.map((r) => r.id);
  const hot = await pool(rows, order, { temperature: 5 }).run;
  assertEquals([...hot.order].sort(), [...order].sort());
  assert(hot.order.join() !== order.join(), "a temperature of 5 kept the sort exactly");
  const near = await pool(rows, order, { temperature: 5, nearest: true }).run;
  assertEquals(near.order, order);
  const cold = await pool(rows, order, { temperature: 0 }).run;
  assertEquals(cold.order, order);
  // Same seed, same order; only the first page moves.
  const again = await pool(rows, order, { temperature: 5 }).run;
  assertEquals(again.order, hot.order);
  const paged = await pool(rows, order, { temperature: 5, pageSize: 20 }).run;
  assertEquals(paged.order.slice(20), order.slice(20));
  assertEquals([...paged.order.slice(0, 20)].sort(), order.slice(0, 20));
  // preShuffle: each first-page id's merged rank before the shuffle.
  assertEquals(Object.keys(paged.preShuffle).length, 20);
  for (const [id, rank] of Object.entries(paged.preShuffle)) assertEquals(order[rank - 1], id);
});

Deno.test("the lanes merge: ad slots carry adIds over the whole order, the ad cards wear `ad`; nearest has no lanes (MESITA-4454)", async () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(i, i === 25 || i === 28 ? { boost_tier: 2 } : {}));
  const organic = rows.map((r) => r.id);
  const premier = [pid(28), pid(25)];
  const { run, calls, lanesCalls } = pool(rows, organic, { premier, pageSize: 10 });
  const out = await run;
  assertEquals([lanesCalls.length, calls.length], [1, 0]);
  assertEquals(out.order.slice(0, 5), [pid(0), pid(28), pid(1), pid(25), pid(2)]);
  assertEquals(out.order.length, 30);
  assertEquals(new Set(out.order).size, 30);
  assertEquals(out.adIds, premier);
  // Every ad-slot id on the page is marked, and nothing else is.
  assertEquals(out.places.filter((p) => p.ad).map((p) => p.id), premier);
  assertEquals(out.summary.ads, 2);
  assertEquals(out.lanes, { organic: 30, premier: 2, belowFloor: 2, inorganicTotal: 4, adsFirstPage: 2 });
  // adEvery 0: no ad slots at all.
  const off = await pool(rows, organic, { premier, adEvery: 0 }).run;
  assertEquals([off.adIds, off.order], [[], organic]);
  // nearest: catalog_rank alone, no ads, no lanes, no shuffle.
  const nearest = pool(rows, organic, { premier, nearest: true, temperature: 5 });
  const n = await nearest.run;
  assertEquals([nearest.calls.length, nearest.lanesCalls.length], [1, 0]);
  assertEquals([n.adIds, n.order, n.preShuffle], [[], organic, {}]);
  assertEquals(n.places.some((p) => p.ad), false);
});

Deno.test("rankMode: absent is family with familyKeys else popular; anything else is refused (DX-c)", () => {
  assertEquals(readRankMode(undefined, []), { ok: true, rankMode: "popular" });
  assertEquals(readRankMode(null, ["tacos"]), { ok: true, rankMode: "family" });
  for (const m of ["nearby", "popular", "family"] as const) assertEquals(readRankMode(m, []), { ok: true, rankMode: m });
  for (const bad of ["near", "all", "Nearby", "", 1, {}]) assertEquals(readRankMode(bad, []), { ok: false, got: bad });
});

Deno.test("shuffleSeed: an integer 0…2^32 − 1, 0 included; absent draws one (L-4)", () => {
  assertEquals(readShuffleSeed(0), { ok: true, seed: 0, sent: true });
  assertEquals(readShuffleSeed(4294967295), { ok: true, seed: 4294967295, sent: true });
  assertEquals(readShuffleSeed(undefined, () => 42), { ok: true, seed: 42, sent: false });
  for (const bad of [-1, 4294967296, 1.5, "7", Number.NaN]) assertEquals(readShuffleSeed(bad).ok, false, String(bad));
  // The seed's point is a valid pair or nothing.
  assertEquals(readSeedPoint({ seedLat: 25.6, seedLng: -100.3 }), { lat: 25.6, lng: -100.3 });
  assertEquals(readSeedPoint({ seedLat: 25.6 }), null);
  assertEquals(readSeedPoint({ seedLat: 99, seedLng: 0 }), null);
});

Deno.test("list-catalog: every refusal is a 400 with its code before any read (MESITA-4454)", async () => {
  const src = await Deno.readTextFile(new URL("../consumer-web-list-catalog/index.ts", import.meta.url));
  const firstRead = src.indexOf("loadDiscoveryConfigWithMeta(admin)");
  for (const code of ["rank_mode_invalid", "shuffle_seed_invalid", "location_required"]) {
    const at = src.indexOf(`"${code}"`);
    assert(at > 0 && at < firstRead, `${code} is refused before the config read`);
  }
  assert(src.includes("send lat/lng or use rankMode popular"));
  // The rank answers the lanes' contract.
  for (const key of ["adIds: pool.adIds", "lanes: true", "preShuffle: pool.preShuffle", "seed: seeded.seed", "updatedAt: loaded.updatedAt"]) {
    assert(src.includes(key), key);
  }
  // The rank goes through the lanes; `nearest` keeps catalog_rank.
  assert(src.includes('admin.rpc("catalog_rank_lanes", args)'));
  assert(src.includes('admin.rpc("catalog_rank", args)'));
});

Deno.test("a kept id pass 2 does not return is skipped and counted, never backfilled", async () => {
  const rows = Array.from({ length: 150 }, (_, i) => row(i));
  const order = rows.map((r) => r.id);
  const { run } = pool(rows, order, { dropFromCards: [pid(0)] });
  const { places, summary } = await run;
  assertEquals(places.length, 99);
  assertEquals(summary.missing, 1);
  assertEquals(places.some((p) => p.id === pid(0)), false);
});

Deno.test("a failed read names its pass and its page or chunk", async () => {
  const rows = Array.from({ length: 450 }, (_, i) => row(i));
  const order = rows.map((r) => r.id);
  const scan = await assertRejects(() => pool(rows, order, { failRank: true }).run, CatalogReadError);
  assertEquals([scan.pass, scan.at, scan.pgCode], [1, 0, "57014"]);
  const card = await assertRejects(
    () => pool(rows, order, { pageSize: 450, fail: { pass: 2, at: 2 } }).run,
    CatalogReadError,
  );
  assertEquals([card.pass, card.at], [2, 2]);
});

Deno.test("an empty catalog ranks once and reads no cards", async () => {
  const { run, seen } = pool([], []);
  const { places, summary, order } = await run;
  assertEquals([places, order], [[], []]);
  assertEquals(summary.chunks, 0);
  assertEquals(seen.length, 0);
});

Deno.test("list-catalog: a pass-2 error is a 502 with the code and no PostgREST text", async () => {
  const src = await Deno.readTextFile(new URL("../consumer-web-list-catalog/index.ts", import.meta.url));
  assert(src.includes('code: "catalog_read_failed"'));
  assert(src.includes('error: "Catalog read failed"'));
  assert(src.includes("}, 502);"));
  // The PostgREST message goes to the log line only.
  assertEquals(/json\(\{[^}]*err\.message/s.test(src), false);
  assertEquals(src.includes("error: error.message"), false);
});

Deno.test("the Map ranks every place in its ring and keeps the best placesShown, not the first 1000 by id (MESITA-2950)", async () => {
  // 1,500 places inside the ring; the 50 most loved have the highest ids, so
  // the old id-ordered 1000-row read never saw them.
  const rows = Array.from({ length: 1500 }, (_, i) =>
    row(i, i >= 1450 ? { google_stars_overall: 4.9, google_review_count: 5000 } : {}));
  const fake = fakeRead(rows);
  const cfg = { ...DISCOVERY_DEFAULTS, map: { ...DISCOVERY_DEFAULTS.map, placesShown: 50 } };
  const { places, summary } = await selectMapPool({
    read: fake.read,
    cfg,
    center: CENTER,
    radiusKm: 3,
    families: [],
    cardColumns: CARDS,
    wire,
  });
  assertEquals(places.length, 50);
  for (let i = 1450; i < 1500; i++) assert(places.some((p) => p.id === pid(i)), pid(i));
  assertEquals(summary.surface, "map");
  assertEquals([summary.read, summary.total, summary.returned, summary.chunks], [1500, 1500, 50, 1]);
  assertEquals(summary.halfKm, null);
  // Both passes are boxed to the ring; pass 2 reads only the kept cards.
  for (const s of fake.seen) assertEquals(s.bbox, true);
  const cards = fake.seen.filter((s) => s.columns === CARDS);
  assertEquals(cards.length, 1);
  assertEquals(cards[0].in!.length, 50);
});

Deno.test("list-places: a failed read is a 502 with the code and no PostgREST text", async () => {
  const src = await Deno.readTextFile(new URL("../consumer-web-list-places/index.ts", import.meta.url));
  assert(src.includes("selectMapPool"));
  assert(src.includes('code: "places_read_failed"'));
  assertEquals(/json\(\{[^}]*err\.message/s.test(src), false);
  // No capped single read is left to rank a slice.
  assertEquals(src.includes(".limit("), false);
});

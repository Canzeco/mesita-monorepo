// The Map's two-pass read (MESITA-2950): walk every gated row's scoring
// columns by id, rank them all, keep the top, then read only those cards.
// The Catalog ranks in SQL (`catalog_rank`, MESITA-3059) and reads only its
// first page's cards; `order` carries every ranked id (MESITA-3057). A fake
// PostgREST builder and a fake rank stand in for the database.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  CATALOG_SCAN_PAGE,
  CATALOG_SCORING_COLUMNS,
  catalogRankArgs,
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

/** A fake `catalog_rank`: answers this order (or an error) and records its
 *  arguments. */
function fakeRank(order: string[], opts: { fail?: boolean; read?: number } = {}) {
  const calls: Record<string, unknown>[] = [];
  const rank: CatalogRankRpc = (args) => {
    calls.push(args);
    return Promise.resolve(
      opts.fail
        ? { data: null, error: { message: "boom: relation detail", code: "57014" } }
        : { data: { read: opts.read ?? order.length, ids: order }, error: null },
    );
  };
  return { rank, calls };
}

function pool(
  rows: PoolRow[],
  order: string[],
  opts: Parameters<typeof fakeRead>[1] & { pageSize?: number; failRank?: boolean } = {},
) {
  const fake = fakeRead(rows, opts);
  const ranker = fakeRank(order, { fail: opts.failRank });
  const run = selectCatalogPool({
    rank: ranker.rank,
    read: fake.read,
    cfg: DISCOVERY_DEFAULTS,
    location: resolveAreaLocation(CENTER, null),
    families: [],
    cardColumns: CARDS,
    wire,
    pageSize: opts.pageSize ?? 100,
  });
  return { run, seen: fake.seen, calls: ranker.calls };
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
  const { run, seen, calls } = pool(rows, order, { pageSize: 100 });
  const out = await run;
  assertEquals(calls.length, 1);
  // No scoring-column walk at all, so no 10,000-row cap.
  assertEquals(seen.filter((s) => s.columns === CATALOG_SCORING_COLUMNS).length, 0);
  const asked = seen.filter((s) => s.columns === CARDS).flatMap((s) => s.in ?? []);
  assertEquals(asked, order.slice(0, 100));
  assertEquals(out.order, order);
  assertEquals(out.places.map((p) => p.id), order.slice(0, 100));
  // Each card carries its breakdown, scored from the same point.
  assertEquals(out.places[0].area.halfKm, 1);
  assertEquals(out.places[0].name, "Place 1249");
  assertEquals(
    [out.summary.read, out.summary.total, out.summary.returned, out.summary.chunks, out.summary.missing],
    [1250, 1250, 100, 1, 0],
  );
  assertEquals(out.summary.surface, "catalog");
});

Deno.test("catalog_rank's arguments are the engine's own knobs and constants", () => {
  const args = catalogRankArgs(DISCOVERY_DEFAULTS, resolveAreaLocation(CENTER, null), ["dinner"], true);
  assertEquals([args.p_lat, args.p_lng], [CENTER.lat, CENTER.lng]);
  assertEquals([args.p_premier_1, args.p_premier_2], [PREMIER_FACTOR[1], PREMIER_FACTOR[2]]);
  assertEquals(args.p_families, ["dinner"]);
  assert((args.p_known_families as string[]).includes("dinner"));
  assertEquals((args.p_known_families as string[]).includes("undefined"), false);
  assertEquals(args.p_require_active, DISCOVERY_DEFAULTS.general.requireActive);
  assertEquals(args.p_nearest, true);
  const none = catalogRankArgs(DISCOVERY_DEFAULTS, resolveAreaLocation(null, null), [], false);
  assertEquals([none.p_lat, none.p_lng], [null, null]);
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

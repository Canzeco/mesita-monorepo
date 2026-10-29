// The Catalog's two-pass read (MESITA-2921): walk every gated row's scoring
// columns by id, rank them all, keep the best 1000, then read only their
// cards. A fake PostgREST builder stands in for the database.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  CATALOG_RETURN_MAX,
  CATALOG_SCAN_PAGE,
  CATALOG_SCORING_COLUMNS,
  CatalogReadError,
  type PoolBuilder,
  type PoolRow,
  resolveAreaLocation,
  selectCatalogPool,
  selectMapPool,
  walkScoringRows,
} from "./area-pipeline.ts";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";

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

function pool(rows: PoolRow[], opts: Parameters<typeof fakeRead>[1] & { pagesMax?: number } = {}) {
  const fake = fakeRead(rows, opts);
  const run = selectCatalogPool({
    read: fake.read,
    cfg: DISCOVERY_DEFAULTS,
    location: resolveAreaLocation(CENTER, null),
    families: [],
    cardColumns: CARDS,
    wire,
    pagesMax: opts.pagesMax,
  });
  return { run, seen: fake.seen };
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

Deno.test("the Catalog keeps the best 1000 BY RANK, not the first 1000 by id (MESITA-2921)", async () => {
  // 1,500 places; the 500 with the highest ids are the most loved, so an
  // id-ordered 1000-row cut would have dropped every one of them.
  const rows = Array.from({ length: 1500 }, (_, i) =>
    row(i, i >= 1000 ? { google_stars_overall: 4.9, google_review_count: 5000 } : {}));
  const { run, seen } = pool(rows);
  const { places, summary } = await run;
  assertEquals(places.length, CATALOG_RETURN_MAX);
  const kept = new Set(places.map((p) => p.id));
  for (let i = 1000; i < 1500; i++) assert(kept.has(pid(i)), pid(i));
  // Rank order survives pass 2, and every place carries its card and breakdown.
  const finals = places.map((p) => p.area.final);
  assertEquals(finals, [...finals].sort((a, b) => b - a));
  assertEquals(places[0].name, "Place 1000");
  assertEquals(places[0].area.halfKm, 1);
  assertEquals(summary.read, 1500);
  assertEquals(summary.total, 1500);
  assertEquals(summary.returned, 1000);
  assertEquals(summary.chunks, 5);
  assertEquals(summary.missing, 0);
  assertEquals(summary.surface, "catalog");
  // Pass 2 reads cards only for the kept ids, 200 per chunk.
  const cards = seen.filter((s) => s.columns === CARDS);
  assertEquals(cards.length, 5);
  for (const c of cards) assertEquals(c.limit, c.in!.length);
});

Deno.test("a kept id pass 2 does not return is skipped and counted, never backfilled", async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => row(i, i === 0 ? { google_review_count: 9000 } : {}));
  const { run } = pool(rows, { dropFromCards: [pid(0)] });
  const { places, summary } = await run;
  assertEquals(places.length, 999);
  assertEquals(summary.missing, 1);
  assertEquals(places.some((p) => p.id === pid(0)), false);
});

Deno.test("a failed read names its pass and its page or chunk", async () => {
  const rows = Array.from({ length: 450 }, (_, i) => row(i));
  const scan = await assertRejects(() => pool(rows, { fail: { pass: 1, at: 0 } }).run, CatalogReadError);
  assertEquals([scan.pass, scan.at, scan.pgCode], [1, 0, "57014"]);
  const card = await assertRejects(() => pool(rows, { fail: { pass: 2, at: 2 } }).run, CatalogReadError);
  assertEquals([card.pass, card.at], [2, 2]);
});

Deno.test("an empty catalog reads one empty page and no cards", async () => {
  const { run, seen } = pool([]);
  const { places, summary } = await run;
  assertEquals(places, []);
  assertEquals(summary.chunks, 0);
  assertEquals(seen.length, 1);
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

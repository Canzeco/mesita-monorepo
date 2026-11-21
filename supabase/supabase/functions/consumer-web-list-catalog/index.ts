// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// THE CATALOG PIPELINE (Home's Places; split from Area by MESITA-2909,
// `_shared/area-pipeline.ts`). Every ready Mesita place (the family row's
// families pushed into the read) is gated, scored and ranked in SQL in one
// statement, no row cap (MESITA-3059), and only the first page of that
// ranked list keeps its cards (MESITA-3044). Ties break on distance then id.
//
// RANK ONCE, FILL BY ID (MESITA-3057): a rank answers `order`, every ranked
// id, with the first page's cards; Home then sends `fill`, up to
// `CATALOG_PAGE_SIZE_MAX` of those ids, and gets only their cards, read
// through the same gates and scored from the point it sends (the rank's).
// Nothing is ranked again on scroll. Any request without `fill` is a rank.
// Every log line names its `mode` (fill | rank). Nothing here calls Google.
//
// DISCOVERY RANKING v2 (MESITA-4454): one formula, two lanes, three modes.
//   Score     = Proximity × ((1 − w) × stars × reviews + w × growth) ^ GoogleExp
//               × premierFactor ^ PremierExp
//   Proximity = 1 ÷ (1 + (distance ÷ HalfDistance) ^ DistanceExp); no point = 1
//   premierFactor = 1 · 2 · 5 (no plan · 2X · 5X)
// The numbers are the mode's recipe rows (`params.recipes`). SQL
// (`catalog_rank_lanes`) ranks the Organic lane (every place; the n-th of a
// kind × `params.variety.repeat`^(n − 1), off on Nearby) and the Inorganic
// lane (Premier places whose Proximity × premierFactor reaches
// `params.mix.adFloor`). FEEDS AND LANES (MESITA-4517, MESITA-4548): Nearby
// is close + both, Popular is popular + both, Family is close + well known
// + both of one family; both = strong on close and on well known, ordered
// by the worse rank. Every lane has an Organic and an Inorganic row; one SQL
// rank per lane. Each
// lane gives its `batch` per weave; a weave interleaves the lanes and puts
// one ad after every `params.mix.adEvery` organic places (0 = no ads; a
// place appears once), weaves repeating until the lanes run out. The first
// weave is the page and is shuffled by the mode's `params.mix.temperature`
// with the guest's seed, keyed per place; the
// tail keeps its exact order. A place with 0 reviews or no stars ranks last.
// RETIRED, UNREAD (kept in the row until a follow-up migration deletes
// them): `params.proximity`, `params.popularity.root`,
// `params.popularity.starsPower`, `params.shuffle.temperature`.
//
// Request: POST { lat?, lng?, familyKeys?, rankMode?, shuffleSeed?,
//   seedLat?, seedLng?, nearest?, fill?, adIds? }   (any request without
//   `fill` is a rank)
//   rankMode     "nearby" | "popular" | "family"; absent → familyKeys ?
//                family : popular. Anything else = 400 `rank_mode_invalid`
//                before any read. "nearby" with no point = 400
//                `location_required`.
//   shuffleSeed  integer 0…2^32 − 1 (one per page load and mode); absent
//                draws one, echoed as `seed`. Anything else = 400
//                `shuffle_seed_invalid`.
//   seedLat/Lng  the point the seed was made at (sent until the guest moves
//                300 m): when a valid pair, it is the point that ranks.
//   lat/lng      a POINT; none = no location (Proximity abstains at 1).
//   familyKeys   the family row's families (MESITA-2438); absent = every one.
//   nearest      true: `order` is distance alone (the Reward tab,
//                MESITA-3214): no lanes, no ads (`adIds: []`), no shuffle.
//   fill         1..100 Mesita ids (uuids, duplicates collapsed): their cards
//                only, in that order; anything else = 400 `fill_invalid`.
//   adIds        with `fill`: the rank's `adIds` (uuids); those cards score
//                with the mode's Inorganic row and carry `ad: true`. A fill
//                never adds or removes an ad.
//   laneOf       with `fill`: the rank's `laneOf` for those ids; each card
//                scores with its organic lane's row and carries `lane`.
//   radiusKm, bounds, google, unified, prefer, minReviews: ignored.
// Rank response: { ok, location: { kind }, rankMode, pageSize, total, order,
//   adIds, lanes: true, preShuffle, seed, updatedAt, places: [... { area,
//   ad? }], summary }.
//   order       every ranked id: the shuffled first page, then the merged tail
//   adIds       ids sitting in ad slots, across the whole order
//   laneOf      id → the recipe row it was woven from (MESITA-4517); a fill
//               sends its ids' entries back so each card scores by its lane
//   weaves      each weave's length; pageSize is the first
//   preShuffle  id → its 1-based merged rank before the shuffle (first page)
//   seed        the shuffle's seed (sent or drawn)
//   updatedAt   the config row's updated_at: a change drops cached orders
//   ad          true on a place in an ad slot (it wears "Ad"); else absent
// Fill response: { ok, rankMode, places: [... { area, ad? }], summary:
//   { asked, returned, chunks, ads } }.
// Errors: 400 { ok: false, code, error, got?, requestId } for
//   rank_mode_invalid · location_required · shuffle_seed_invalid ·
//   fill_invalid; 502 { ok: false, code: "catalog_read_failed", error, pass,
//   page | chunk, requestId } (pass 1 is the SQL rank, pass 2 a card chunk;
//   the PostgREST message is logged, never sent). Read-only, safe to retry.
//
// Local:  supabase functions serve consumer-web-list-catalog
// Deploy: supabase functions deploy consumer-web-list-catalog

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import {
  CATALOG_PAGE_SIZE_MAX,
  isMapRow,
  loadDiscoveryConfigWithMeta,
  RECIPE_ROWS,
  type RecipeRow,
} from "../_shared/discovery-config.ts";
import { decideNearby } from "../_shared/geo.ts";
import {
  areaPoolLogFields,
  CatalogReadError,
  type PoolBuilder,
  type PoolRow,
  resolveAreaLocation,
  selectCatalogFill,
  selectCatalogPool,
} from "../_shared/area-pipeline.ts";
import { readRankMode, readSeedPoint, readShuffleSeed } from "../_shared/catalog-request.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";
import { withVouchersUpTo } from "../_shared/payments.ts";
import { withPlaceOffers } from "../_shared/vouchers.ts";
import { isUuid } from "../_shared/place-id.ts";
import { demoteSeen, readSeen } from "./seen.ts";

type Body = {
  lat?: number;
  lng?: number;
  /** Ignored since MESITA-2909: the Catalog has no radius. */
  radiusKm?: unknown;
  /** Sent by builds from before MESITA-2500; ignored, only logged. */
  bounds?: unknown;
  /** Ignored since MESITA-2872: no Google stub comes back. */
  google?: boolean;
  /** Ignored since MESITA-2417; no reviews minimum since MESITA-2721. */
  minReviews?: unknown;
  /** Ignored since MESITA-2398; every build sends unified. */
  unified?: unknown;
  /** Ignored since MESITA-2516; `rankMode` is the guest's question. */
  prefer?: unknown;
  /** The family row's families (MESITA-2438); absent or empty = every family. */
  familyKeys?: unknown;
  /** Ignored since MESITA-3058: every non-fill request is a rank. */
  ids?: unknown;
  /** Sort by distance alone (the Reward tab, MESITA-3214). */
  nearest?: unknown;
  /** Ids from an `order` whose cards Home wants (MESITA-3057). */
  fill?: unknown;
  /** nearby | popular | family (MESITA-4454). */
  rankMode?: unknown;
  /** The first-page shuffle's seed, uint32 (MESITA-4454). */
  shuffleSeed?: unknown;
  /** The point the seed was made at (MESITA-4454, M-a). */
  seedLat?: unknown;
  seedLng?: unknown;
  /** With `fill`: the rank's ad-slot ids (MESITA-4454, M-c). */
  adIds?: unknown;
  /** Place ids Home has already shown 3+ times (MESITA-4459). */
  seen?: unknown;
  /** With `fill`: id → the lane the rank wove it from (MESITA-4517). */
  laneOf?: unknown;
};

/** A fill's `laneOf`: absent is none; an object of uuid → Catalog recipe
 *  row (organic or, since MESITA-4548, Inorganic), else null. */
function readLaneOf(v: unknown): Record<string, RecipeRow> | null {
  if (v === undefined || v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, RecipeRow> = {};
  for (const [id, row] of Object.entries(v as Record<string, unknown>)) {
    if (!isUuid(id) || typeof row !== "string") return null;
    if (!(RECIPE_ROWS as readonly string[]).includes(row)) return null;
    if (isMapRow(row as RecipeRow)) continue;
    out[id] = row as RecipeRow;
  }
  return out;
}

/** A fill's ids, duplicates collapsed, or null when the list is empty, too
 *  long or holds a non-uuid. */
function readFill(v: unknown[]): string[] | null {
  const ids = [...new Set(v)];
  if (ids.length === 0 || ids.length > CATALOG_PAGE_SIZE_MAX) return null;
  return ids.every((id) => isUuid(id)) ? ids as string[] : null;
}

/** A fill's `adIds`: absent is none; an array of uuids, else null. */
function readAdIds(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  return v.every((id) => isUuid(id)) ? [...new Set(v as string[])] : null;
}

function wirePlaces(rows: unknown[]): PoolRow[] {
  return (rows as PlaceProfileRow[]).map((r) => {
    const out = stripInternal(r);
    return {
      ...out,
      id: r.id,
      photos: Array.isArray(out.photos) ? out.photos : [],
    } as PoolRow; // photos already effective via stripInternal
  });
}

// Anonymous on purpose (MESITA-4208): the page shows the place's offers,
// so an anon token is never resolved into a user.
serveJson("consumer-web-list-catalog", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<Body>(req, {});
  const requestId = crypto.randomUUID();
  const fill = Array.isArray(body.fill) ? body.fill : null;
  const mode = fill !== null ? "fill" : "rank";
  const families = readGuestFamilyKeys(body.familyKeys).filter((f) => f !== "undefined");
  const refuse = (code: string, error: string, extra: Record<string, unknown> = {}) => {
    console.warn(JSON.stringify({ fn: "consumer-web-list-catalog", event: code, requestId, mode, ...extra }));
    return json({ ok: false, code, error, ...extra, requestId }, 400);
  };

  // Every refusal comes before any read (DX-c, L-4).
  const asked = readRankMode(body.rankMode, families);
  if (!asked.ok) {
    return refuse("rank_mode_invalid", "rankMode is nearby, popular or family", { got: asked.got });
  }
  const rankMode = asked.rankMode;
  const seeded = readShuffleSeed(body.shuffleSeed);
  if (!seeded.ok) {
    return refuse("shuffle_seed_invalid", "shuffleSeed is an integer from 0 to 4294967295", { got: seeded.got });
  }
  // The seed's point ranks while the guest stays near it (M-a); else the
  // request's own point.
  const nearby = decideNearby(body as Record<string, unknown>);
  const center = readSeedPoint(body as Record<string, unknown>) ??
    (nearby.mode === "ok" ? { lat: nearby.lat, lng: nearby.lng } : null);
  const nearest = body.nearest === true;
  if (rankMode === "nearby" && center === null && !nearest) {
    return refuse("location_required", "send lat/lng or use rankMode popular");
  }

  const loaded = await loadDiscoveryConfigWithMeta(admin);
  const cfg = loaded.cfg;
  if (loaded.clamped.length > 0) {
    console.warn(JSON.stringify({
      fn: "consumer-web-list-catalog",
      event: "config_clamped",
      requestId,
      clamped: loaded.clamped,
    }));
  }
  // Home ranks from a point or nothing (MESITA-2500), with no radius
  // (MESITA-2909): the point only scores.
  if (body.bounds !== undefined && body.bounds !== null) {
    console.log(JSON.stringify({ fn: "consumer-web-list-catalog", event: "bounds_ignored" }));
  }
  const location = resolveAreaLocation(center, null);

  const started = Date.now();
  const readError = (err: CatalogReadError) => {
    const at = err.pass === 1 ? { page: err.at } : { chunk: err.at };
    console.error(JSON.stringify({
      fn: "consumer-web-list-catalog",
      event: "catalog_page_error",
      requestId,
      mode,
      rankMode,
      pass: err.pass,
      ...at,
      pgCode: err.pgCode,
      message: err.message,
    }));
    return json({
      ok: false,
      code: "catalog_read_failed",
      error: "Catalog read failed",
      pass: err.pass,
      ...at,
      requestId,
    }, 502);
  };
  const read = (columns: string) =>
    admin.from("profiles").select(columns).eq("state", "active") as unknown as PoolBuilder;

  if (fill !== null) {
    const ids = readFill(fill);
    const adIds = readAdIds(body.adIds);
    const laneOf = readLaneOf(body.laneOf);
    if (ids === null || adIds === null || laneOf === null) {
      return refuse("fill_invalid", "fill takes 1 to 100 place ids; adIds takes place ids; laneOf maps place ids to lanes", {
        n: fill.length,
      });
    }
    let filled: Awaited<ReturnType<typeof selectCatalogFill<PoolRow>>>;
    try {
      filled = await selectCatalogFill<PoolRow>({
        read,
        cfg,
        location,
        families,
        cardColumns: PLACE_CARD_COLUMNS,
        wire: wirePlaces,
        ids,
        mode: rankMode,
        adIds,
        laneOf,
      });
    } catch (err) {
      if (!(err instanceof CatalogReadError)) throw err;
      return readError(err);
    }
    console.log(JSON.stringify({
      fn: "consumer-web-list-catalog",
      event: "catalog_fill",
      requestId,
      mode,
      rankMode,
      ms: Date.now() - started,
      location: location.kind,
      familyKeys: families,
      ...filled.summary,
    }));
    // The tile's voucher line (MESITA-3312), two reads for the page; every
    // offer the place sells, whoever looks (MESITA-4292).
    const fillPlaces = withPlaceOffers(await withVouchersUpTo(admin, filled.places));
    return json({ ok: true, rankMode, places: fillPlaces, summary: filled.summary });
  }

  let pool: Awaited<ReturnType<typeof selectCatalogPool<PoolRow>>>;
  try {
    pool = await selectCatalogPool<PoolRow>({
      // The rank itself is SQL (MESITA-3059): every gated place, no row cap.
      // `nearest` keeps the distance-only rank; every mode ranks two lanes.
      rank: (args) => admin.rpc("catalog_rank", args),
      rankLanes: (args) => admin.rpc("catalog_rank_lanes", args),
      growthBases: (args) => admin.rpc("discovery_growth_bases", args),
      read,
      cfg,
      location,
      families,
      // Card columns only: no Catalog signal reads the summary vector, so the
      // pool does not select it (MESITA-2328).
      cardColumns: PLACE_CARD_COLUMNS,
      wire: wirePlaces,
      nearest,
      mode: rankMode,
      seed: seeded.seed,
      // `nearest` answers 20 cards; every mode's page is its first weave
      // (MESITA-4517), and `order` carries the rest by id.
      pageSize: 20,
    });
  } catch (err) {
    if (!(err instanceof CatalogReadError)) throw err;
    return readError(err);
  }

  // The tile's voucher line (MESITA-3312), two reads for the page; every
  // offer the place sells, whoever looks (MESITA-4292).
  const page = pool.summary.pageSize ?? pool.places.length;
  const order = demoteSeen(pool.order, readSeen(body.seen), page);
  const byId = new Map(pool.places.map((p) => [p.id, p]));
  const shown = [];
  for (const id of order.slice(0, page)) {
    const row = byId.get(id);
    if (row) shown.push(row);
  }
  const places = withPlaceOffers(await withVouchersUpTo(admin, shown.length > 0 ? shown : pool.places));

  console.log(JSON.stringify({
    fn: "consumer-web-list-catalog",
    wire: "unified",
    requestId,
    mode,
    rankMode,
    nearest,
    ms: Date.now() - started,
    location: location.kind,
    familyKeys: families,
    ...pool.summary,
    organic: pool.lanes.organic,
    premier: pool.lanes.premier,
    adsFirstPage: pool.lanes.adsFirstPage,
    below_floor: pool.lanes.belowFloor,
    inorganicTotal: pool.lanes.inorganicTotal,
    byLane: pool.lanes.byLane,
    weaves: pool.weaves.slice(0, 5),
    seed: seeded.seed,
    seedSent: seeded.sent,
    preShuffle: pool.preShuffle,
    updatedAt: loaded.updatedAt,
    ...areaPoolLogFields(pool.places),
  }));

  return json({
    ok: true,
    // No radius on the wire: the Catalog has none and the location sheet
    // names none (MESITA-2914).
    location: { kind: location.kind },
    rankMode,
    pageSize: pool.summary.pageSize,
    total: pool.summary.total,
    order,
    adIds: pool.adIds,
    lanes: true,
    laneOf: pool.laneOf,
    weaves: pool.weaves,
    preShuffle: pool.preShuffle,
    seed: seeded.seed,
    updatedAt: loaded.updatedAt,
    places,
    summary: pool.summary,
  });
});

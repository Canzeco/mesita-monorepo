// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// THE CATALOG PIPELINE (Home's Places; split from Area by MESITA-2909,
// `_shared/area-pipeline.ts`). Every ready Mesita place (the family row's
// families pushed into the read) is gated, scored and ranked in SQL
// (`catalog_rank`, MESITA-3059: one statement, no row cap), and only the
// first page of that ranked list keeps its cards (MESITA-3044, Pato: "sort all catalog places in one run, but don't
// load them all … never stop until the catalog is gone"). Ties break on
// distance then id, so the order is stable (MESITA-2921: a capped id-ordered
// read ranked a random 1000).
//
// RANK ONCE, FILL BY ID (MESITA-3057, Pato: "don't bring the data of all
// 1000 places in one run … have all the ids … then populate with data and
// the images"): `ids: true` ranks once and answers `order`, every ranked id
// best first, with the first page's cards; Home then sends `fill`, up to
// `CATALOG_PAGE_SIZE_MAX` of those ids, and gets only their cards, read
// through the same gates and scored from the point it sends (the rank's).
// Nothing is ranked again on scroll. The `offset` pages and the bare
// best-1000 answer are gone (MESITA-3058: no build sent them in 10 days);
// any request without `fill` is a rank. Every log line names its `mode`.
// Nothing here calls Google (MESITA-2872).
//
// NO RADIUS (Pato, MESITA-2909: "en Catalog no nos importa … no hay un
// radio"): distance never cuts a place. THE SCORE: Proximity × Popularity ×
// the Premier factor (a Premier place's paid tier, ×2 · ×5, MESITA-2925;
// one list again since MESITA-3041, the two lanes of MESITA-3016 retired),
// Proximity = 1 ÷ (1 + (d ÷ D)^e), D the operator's half distance
// (`params.proximity.halfKm`, MESITA-3015) and e the operator's exponent
// (`params.proximity.exponent`, MESITA-3083): 1 at the guest, ½ at D; at
// e = 1, ⅓ at twice D. Popularity = (1 + reviews × stars)^root, the root
// the operator's (`params.popularity.root`, 0.33 = the cube root,
// MESITA-3083). Live 1 km · 1 · 0.33: 8× the reviews = a ×2 plan = twice
// as close. No point: Popularity × the factor.
//
// A FAMILY ROW ASKS ITS OWN QUESTION (MESITA-2438): `familyKeys` pushes the
// Family gate into the Mesita read. Without it the pool is every family's.
//
// Request: POST { unified: true, google: true, lat, lng, familyKeys?,
//   fill? | ids? }   (that precedence; one per request)
//   fill      1..100 Mesita ids (uuids, duplicates collapsed): their cards
//             only, in that order; anything else in an array = 400
//             `fill_invalid`. Answer { ok, places, summary: { asked,
//             returned, chunks } }.
//   ids       true: rank once and answer `order` (every ranked id) + the
//             first page's cards. A request without `fill` is a rank either
//             way (MESITA-3058).
//   nearest   true, with `ids`: `order` is distance alone, nearest first, for
//             the Reward tab (MESITA-3214). Home's score still fills `area`.
//   lat/lng   a POINT; none = no location (Popularity alone).
//   radiusKm  ignored since MESITA-2909 (the Catalog has no radius); pins
//             carry none since MESITA-2914.
//   bounds    ignored (Territory retired, MESITA-2500).
//   google    ignored since MESITA-2872 (no Google stub comes back).
// Response: { ok, location: { kind }, pageSize, total, order,
//   places: [... { area }], summary }.
//   order     every ranked id, best first
//   total     every ranked place (the list the pages walk)
//   summary.read      rows the SQL rank read (before the Family gate)
//   summary.total     rows that passed the gates and were ranked
//   summary.returned  places emitted (the first page)
//   summary.chunks    pass-2 card reads
//   summary.missing   kept ids pass 2 did not return
// Error: 502 { ok: false, code: "catalog_read_failed", error, pass, page |
//   chunk, requestId }; pass 1 is the SQL rank (page 0), pass 2 a card
//   chunk. The PostgREST message is logged, never sent.
//   Read-only, safe to retry.
//
// Local:  supabase functions serve consumer-web-list-catalog
// Deploy: supabase functions deploy consumer-web-list-catalog

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { decideNearby } from "../_shared/geo.ts";
import {
  areaPoolLogFields,
  CatalogReadError,
  catalogPageSize,
  type PoolBuilder,
  type PoolRow,
  resolveAreaLocation,
  selectCatalogFill,
  selectCatalogPool,
} from "../_shared/area-pipeline.ts";
import { CATALOG_PAGE_SIZE_MAX } from "../_shared/discovery-config.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";
import { withVouchersUpTo } from "../_shared/payments.ts";

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
  /** Ignored since MESITA-2516: one ranking, the Map's. */
  prefer?: unknown;
  /** The family row's families (MESITA-2438); absent or empty = every family. */
  familyKeys?: unknown;
  /** `true`: rank once and answer `order` (MESITA-3057). Every non-fill
   *  request is a rank since MESITA-3058. */
  ids?: unknown;
  /** With `ids`: sort by distance alone (the Reward tab, MESITA-3214). */
  nearest?: unknown;
  /** Ids from an `order` whose cards Home wants (MESITA-3057). */
  fill?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A fill's ids, duplicates collapsed, or null when the list is empty, too
 *  long or holds a non-uuid. */
function readFill(v: unknown[]): string[] | null {
  const ids = [...new Set(v)];
  if (ids.length === 0 || ids.length > CATALOG_PAGE_SIZE_MAX) return null;
  return ids.every((id) => typeof id === "string" && UUID.test(id)) ? ids as string[] : null;
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

serveJson("consumer-web-list-catalog", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<Body>(req, {});
  const cfg = await loadDiscoveryConfig(admin);
  const nearby = decideNearby(body as Record<string, unknown>);
  const center = nearby.mode === "ok" ? { lat: nearby.lat, lng: nearby.lng } : null;
  // Home ranks from a point or nothing (MESITA-2500), with no radius
  // (MESITA-2909): the point only scores.
  if (body.bounds !== undefined && body.bounds !== null) {
    console.log(JSON.stringify({ fn: "consumer-web-list-catalog", event: "bounds_ignored" }));
  }
  const location = resolveAreaLocation(center, null);
  const families = readGuestFamilyKeys(body.familyKeys).filter((f) => f !== "undefined");
  const fill = Array.isArray(body.fill) ? body.fill : null;
  const mode = fill !== null ? "fill" : "rank";

  const requestId = crypto.randomUUID();
  const started = Date.now();
  const readError = (err: CatalogReadError) => {
    const at = err.pass === 1 ? { page: err.at } : { chunk: err.at };
    console.error(JSON.stringify({
      fn: "consumer-web-list-catalog",
      event: "catalog_page_error",
      requestId,
      mode,
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
    if (ids === null) {
      console.warn(JSON.stringify({ fn: "consumer-web-list-catalog", event: "fill_invalid", requestId, mode, n: fill.length }));
      return json({ ok: false, code: "fill_invalid", error: "fill takes 1 to 100 place ids", requestId }, 400);
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
      ms: Date.now() - started,
      location: location.kind,
      familyKeys: families,
      ...filled.summary,
    }));
    // The tile's voucher line (MESITA-3312), two reads for the page.
    return json({ ok: true, places: await withVouchersUpTo(admin, filled.places), summary: filled.summary });
  }

  let pool: Awaited<ReturnType<typeof selectCatalogPool<PoolRow>>>;
  try {
    pool = await selectCatalogPool<PoolRow>({
      // The rank itself is SQL (MESITA-3059): every gated place, no row cap.
      rank: (args) => admin.rpc("catalog_rank", args),
      read,
      cfg,
      location,
      families,
      // Card columns only: no Catalog signal reads the summary vector, so the
      // pool does not select it (MESITA-2328).
      cardColumns: PLACE_CARD_COLUMNS,
      wire: wirePlaces,
      nearest: body.nearest === true,
      // A rank answers the first page; `order` carries the rest by id.
      pageSize: catalogPageSize(cfg.map),
    });
  } catch (err) {
    if (!(err instanceof CatalogReadError)) throw err;
    return readError(err);
  }

  // The tile's voucher line (MESITA-3312), two reads for the page.
  const places = await withVouchersUpTo(admin, pool.places);

  console.log(JSON.stringify({
    fn: "consumer-web-list-catalog",
    wire: "unified",
    requestId,
    mode,
    ms: Date.now() - started,
    location: location.kind,
    familyKeys: families,
    ...pool.summary,
    ...areaPoolLogFields(pool.places),
  }));

  return json({
    ok: true,
    // No radius on the wire: the Catalog has none and the location sheet
    // names none (MESITA-2914).
    location: { kind: location.kind },
    pageSize: pool.summary.pageSize,
    total: pool.summary.total,
    order: pool.order,
    places,
    summary: pool.summary,
  });
});

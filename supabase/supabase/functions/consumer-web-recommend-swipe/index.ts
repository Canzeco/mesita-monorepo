// Supabase Edge Function — consumer-web-recommend-swipe (product caller)
//
// The SWIPE engine — the Home deck (Docs › Discovery §B).
//
// This function used to be a Fisher–Yates shuffle over every active place, and
// said so: the Lineup scoring engine was deleted in MESITA-1048 and nothing
// replaced it. MESITA-1196 replaces it. Swipe is now the first engine wired to
// the shared signal library, which is what makes app_config.discovery_config
// an ENFORCED config rather than a staged one — the house rule is that an
// unenforced config is a bug, so the rebuild lands with a consumer surface
// reading it on day one.
//
// TWO LANES, IN THIS ORDER, AND NEVER THE OTHER (see _shared/discovery-blend.ts):
//   1. EARNED — the six signals compose as `s^w` into one score per place.
//   2. BOUGHT — every Nth deck position is a slot a promoting place is moved
//      forward into. It runs on the ALREADY-RANKED list and cannot see a
//      score; the blend runs on a projection that carries no promo field and
//      cannot see a strategy. Money buys a position, never a score.
// `discoveryRank` is the only entry point precisely so no caller can run these
// backwards.
//
// THE SLUG AND THE RESPONSE SHAPE ARE STILL FROZEN. Deployed Expo binaries call
// this endpoint and cannot be redeployed atomically; a changed shape throws
// inside the client helper and every caller silently falls back forever. Keep
// returning { ok, deck, summary: { candidates, embedded } }.
//
// WHAT CHANGED FOR OLD CLIENTS: `lat` / `lng` were accepted-and-discarded under
// the placeholder and are LIVE again — they feed Proximity. That is a strictly
// better deck for a client already sending them, and a client that sends
// nothing gets a neutral Proximity (1) rather than a penalty, so it is
// unaffected. `radiusKm` and `randomness` stay discarded, for the same reason:
// both are now OPERATOR policy, not client input. Randomness is a SIGNAL whose
// exponent lives in admin Discovery, and a hard radius is a FILTER
// (`filters.maxDistanceKm`, off by default) — letting a client override either
// is how a config stops meaning anything. Note the radius is off by default
// precisely because this engine prefers to DEMOTE distance through Proximity's
// log curve rather than exclude on it.
//
// LANE 0 — THE GUEST'S PREDICATE CUT (MESITA-1153). Optional `predicates`
// carries the guest's four discovery filters (context · what · distance ·
// when) and cuts the pool INSIDE the operator's filters, before the two lanes
// above. They used to run in the browser, on the `limit` rows this function had
// already sliced off a ranked catalog — so a predicate matching a fraction p of
// the catalog left ~50p cards however large the catalog grew. A client that
// omits `predicates` — every deployed Expo binary — gets the pool it always
// got, so this is additive on the wire in both directions.
//
// It is `predicates`, not `filters`, because `cfg.filters` in this same
// function is the OPERATOR's admission policy and the two must never be
// mistaken for each other: `_shared/discovery-filters.ts` decides what may
// enter the catalog's pool at all, `_shared/discovery-predicates.ts` narrows
// within it on behalf of one guest, and only the latter can be wrong in a
// direction the browser can still correct.
//
// Local:  supabase functions serve consumer-web-recommend-swipe
// Deploy: supabase functions deploy consumer-web-recommend-swipe

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { clampPositive, stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { discoveryRank } from "../_shared/discovery-blend.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import {
  DISCOVERY_EXTRA_COLUMNS,
  toPromotingFields,
  toSignalPlace,
} from "../_shared/discovery-place.ts";
import { applyDiscoveryFilters, trimToRadius } from "../_shared/discovery-filters.ts";
import {
  applyDeckPredicates,
  readDeckPredicates,
} from "../_shared/discovery-predicates.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
// Hard ceiling on the rows we pull before ranking. The catalog is far smaller
// than this today; it exists so the query can never grow unbounded.
const POOL_CAP = 1000;

type Body = {
  /** Guest latitude. LIVE again — feeds the Proximity signal. */
  lat?: number;
  /** Guest longitude. LIVE again — feeds the Proximity signal. */
  lng?: number;
  /** Accepted for wire compatibility. Ignored — see the header. */
  radiusKm?: number;
  limit?: number;
  /** Accepted for wire compatibility. Ignored — the operator owns this. */
  randomness?: number;
  /**
   * The GUEST's four discovery predicates (see _shared/discovery-predicates.ts
   * — not `cfg.filters`, which is the operator's). Absent = no cut, which is
   * what every pre-MESITA-1153 client sends.
   */
  predicates?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const body = await readJsonOr<Body>(req, {});
  const limit = clampPositive(body.limit, DEFAULT_LIMIT, MAX_LIMIT);

  const admin = adminClient(env);

  // The config is read BEFORE the pool, not after: filters are query
  // PREDICATES (MESITA-1276). The pool is capped at POOL_CAP, so a filter
  // applied after the fetch would thin the deck the guest receives instead of
  // narrowing the catalog it was drawn from.
  const cfg = await loadDiscoveryConfig(admin);
  const geo = {
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
  };

  // The pool needs the promo columns the slotting lane reads, which
  // PLACE_CARD_COLUMNS already carries (they are stripped on the way out by
  // stripInternal), plus the embedding for the Semantic signal.
  //
  // MESITA-1283: this pool feeds a deck of up to POOL_CAP places per
  // request, not one — the card projection (every public column except the
  // five enrichment-filled jsonb ones), not the full single-place read.
  // Nothing in discoveryRank/discovery-filters.ts reads those five;
  // verified against every discovery-*.ts file before wiring.
  //
  // The `ready` gate MESITA-1228 hardcoded here now lives in the Filters box
  // as `requireReady`, still defaulted ON — adopting a shipped gate at its
  // current value is the only migration that changes nothing on landing.
  const base = admin
    .from("profiles")
    .select(`${PLACE_CARD_COLUMNS}, ${DISCOVERY_EXTRA_COLUMNS}`)
    .eq("status", "active");

  const { data, error } = await applyDiscoveryFilters(base, cfg.filters, geo)
    .limit(POOL_CAP);

  if (error) {
    console.error("[recommend-swipe] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const admitted = (data ?? []) as unknown as PlaceRow[];
  // Corner trim: the radius filter is a bounding BOX in the query, so this
  // removes the rows the box admitted that fall outside the true circle. It
  // only ever refines the predicate, never reaches past it.
  const pool = trimToRadius(
    admitted,
    (r) => (r as unknown as Record<string, unknown>).lat as number | null,
    (r) => (r as unknown as Record<string, unknown>).lng as number | null,
    cfg.filters.maxDistanceKm,
    geo,
  );

  // LANE 0 — the GUEST's cut, inside the operator's (MESITA-1153). Same rule
  // as the filters above and the same reason: the pool is capped before
  // anything ranks, so a predicate applied after the `limit` slice thins the
  // deck the guest receives instead of narrowing the catalog it was drawn
  // from. It runs second because an operator's admission rules bound what a
  // guest may narrow, never the other way round.
  const rows = applyDeckPredicates(
    pool as unknown as Record<string, unknown>[],
    readDeckPredicates(body.predicates),
    geo.lat !== null && geo.lng !== null
      ? { lat: geo.lat, lng: geo.lng }
      : null,
  ) as unknown as PlaceRow[];

  // Swipe carries no query and no category intent — the deck is the whole
  // catalog, ordered. Proximity is the only intent a swiping guest expresses,
  // so Category and Semantic abstain at NEUTRAL and drop out of the blend.
  //
  // `engines.swipe.ranked` is the operator's kill switch on the ranking brain.
  // Off serves the pool in its own order — which is what this function did
  // before MESITA-1196 — and the FILTERS and PREDICATES still apply, because
  // admission and ordering are different questions.
  const ordered = cfg.engines.swipe.ranked
    ? discoveryRank(
      rows,
      (r) => toSignalPlace(r as unknown as Record<string, unknown>),
      (r) => toPromotingFields(r as unknown as Record<string, unknown>),
      geo,
      cfg.weights,
      cfg.slotting,
    ).map((r) => r.row)
    : rows;

  // stripInternal also attaches computed `family_keys` (MESITA-679). Keep it.
  const deck = ordered.slice(0, limit).map((r) => stripInternal(r));
  const embedded = rows.filter((r) =>
    (r as unknown as Record<string, unknown>).embedding != null
  ).length;

  // `candidates` counts what was RANKED, i.e. the pool after both cuts — the
  // honest denominator for "the deck is thin". Same field, same shape; a
  // client that sends no predicates sees exactly the number it always saw.
  return json({
    ok: true,
    deck,
    summary: { candidates: rows.length, embedded },
  });
});

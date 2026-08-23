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
// unaffected. `radiusKm` stays discarded: this engine demotes distance, it does
// not filter on it — a hard radius is the filter model MESITA-1183 tore down.
// `randomness` also stays discarded, because randomness is now a SIGNAL whose
// exponent the operator owns in admin Discovery; letting a client override an
// operator's weight is how a config stops meaning anything.
//
// Local:  supabase functions serve consumer-web-recommend-swipe
// Deploy: supabase functions deploy consumer-web-recommend-swipe

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { clampPositive, stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceRow } from "../_shared/place-pool-shape.ts";
import { PLACE_PUBLIC_COLUMNS } from "../_shared/place-columns.ts";
import { discoveryRank } from "../_shared/discovery-blend.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import {
  DISCOVERY_EXTRA_COLUMNS,
  toPromotingFields,
  toSignalPlace,
} from "../_shared/discovery-place.ts";

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

  // The pool needs the promo columns the slotting lane reads, which
  // PLACE_PUBLIC_COLUMNS already carries (they are stripped on the way out by
  // stripInternal), plus the embedding for the Semantic signal.
  const { data, error } = await admin
    .from("profiles")
    .select(`${PLACE_PUBLIC_COLUMNS}, ${DISCOVERY_EXTRA_COLUMNS}`)
    .eq("status", "active")
    .limit(POOL_CAP);

  if (error) {
    console.error("[recommend-swipe] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const rows = (data ?? []) as unknown as PlaceRow[];
  const cfg = await loadDiscoveryConfig(admin);

  // Swipe carries no query and no category intent — the deck is the whole
  // catalog, ordered. Proximity is the only intent a swiping guest expresses,
  // so Category and Semantic abstain at NEUTRAL and drop out of the blend.
  const ranked = discoveryRank(
    rows,
    (r) => toSignalPlace(r as unknown as Record<string, unknown>),
    (r) => toPromotingFields(r as unknown as Record<string, unknown>),
    {
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
    },
    cfg.weights,
    cfg.slotting,
  );

  // stripInternal also attaches computed `family_keys` (MESITA-679). Keep it.
  const deck = ranked.slice(0, limit).map((r) => stripInternal(r.row));
  const embedded = rows.filter((r) =>
    (r as unknown as Record<string, unknown>).embedding != null
  ).length;

  return json({
    ok: true,
    deck,
    summary: { candidates: rows.length, embedded },
  });
});

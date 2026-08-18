// Supabase Edge Function — consumer-web-recommend-swipe (product caller)
//
// Consumer swipe deck. DELIBERATE PLACEHOLDER (MESITA-1048): the Lineup
// scoring engine was deleted — subscores, lanes, the openness table, the
// scoring_config blob and both admin config pages are gone — and nothing has
// replaced it yet. Until a rebuilt engine ships, this function returns every
// ACTIVE place in uniformly random (Fisher–Yates) order. That is the whole
// algorithm. There is no ranking, no personalisation, no embedding, no
// distance weighting. Do not read intent into the order.
//
// The SLUG and the RESPONSE SHAPE are frozen on purpose: deployed Expo
// binaries call this endpoint and cannot be redeployed atomically. A changed
// shape throws inside the client helper and every caller silently falls back
// forever. Keep returning { ok, deck, summary: { candidates, embedded } }.
//
// COMPAT BODY FIELDS: `lat`, `lng`, `radiusKm` and `randomness` are still
// accepted so old clients keep working, but they NO LONGER AFFECT SELECTION —
// they are read and discarded. Only `limit` still does anything (it caps the
// deck). `summary.embedded` is always 0 because nothing embeds here anymore.
//
// Local:  supabase functions serve consumer-web-recommend-swipe
// Deploy: supabase functions deploy consumer-web-recommend-swipe

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { clampPositive, stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceRow } from "../_shared/place-pool-shape.ts";
import { PLACE_PUBLIC_COLUMNS } from "../_shared/place-columns.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
// Hard ceiling on the rows we pull before shuffling. The catalog is far
// smaller than this today; it exists so the query can never grow unbounded.
const POOL_CAP = 1000;

type Body = {
  /** Accepted for wire compatibility. Ignored — see the header. */
  lat?: number;
  /** Accepted for wire compatibility. Ignored — see the header. */
  lng?: number;
  /** Accepted for wire compatibility. Ignored — see the header. */
  radiusKm?: number;
  limit?: number;
  /** Accepted for wire compatibility. Ignored — see the header. */
  randomness?: number;
};

/** In-place Fisher–Yates over a copy. Uniform, unbiased, no ordering bias. */
function shuffle<T>(rows: T[]): T[] {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  const { data, error } = await admin
    .from("profiles")
    .select(PLACE_PUBLIC_COLUMNS)
    .eq("status", "active")
    .limit(POOL_CAP);

  if (error) {
    console.error("[recommend-swipe] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }

  const rows = (data ?? []) as unknown as PlaceRow[];
  // stripInternal also attaches computed `family_keys` (MESITA-679), which the
  // consumer "What" discovery filter reads straight off the wire. Keep it.
  const deck = shuffle(rows).slice(0, limit).map(stripInternal);

  return json({
    ok: true,
    deck,
    summary: { candidates: rows.length, embedded: 0 },
  });
});

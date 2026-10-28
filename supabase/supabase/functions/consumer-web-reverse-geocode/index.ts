// Supabase Edge Function — consumer-web-reverse-geocode (product caller)
//
// Home's location sheet names where the guest stands (MESITA-2466): the
// Current location row reads "Current location · Tecnológico". POST
// `{ lat, lng }` → `{ ok: true, name, areas, suggestedName, formattedAddress }`
// (the most local of neighbourhood · sublocality · city, and the sheet's
// "Around you" rows, MESITA-2471: each area with its rectangle, from the same
// answer) or `{ ok: false, code }`.
//
// A PIN (MESITA-2500): `{ lat, lng, precision: "pin" }` names a saved
// location's pin while the guest places it on a map. Snapped to ~11 m, one
// unfiltered Geocoding call, and only for a signed-in guest (the anon JWT is
// public, and ~11 m cells multiply the distinct calls a script could buy).
// `suggestedName` is the colonia, else the municipio, else "city, state";
// `formattedAddress` is "<street> <number>". Any other `precision` answers
// `bad_precision`.
//
// Codes (Docs › Discovery › Reverse geocode codes): `bad_point` and
// `bad_precision` (the request), `sign_in_required` (a pin without a
// session), `google_unreachable` / `google_over_query_limit` /
// `google_unknown_error` (try again later), `google_request_denied` /
// `google_over_daily_limit` (the key: an operator fix), `no_area_name`
// (Google had nothing here).
//
// One Google Geocoding (reverse) call per snapped point; repeats in this
// isolate come from the caches below, one per precision, and the client
// keeps each answer for the visit. Errors carry real statuses (400 bad input,
// 401 sign_in_required, 502 for every Google failure, rate limits included);
// the client's invokeEF reads `code` from a non-2xx body and the pin picker
// branches on `code`, never the status (MESITA-2855). `no_area_name` stays
// 200: Google answered, it just had no name here, and the picker treats it
// as final.
//
// JWT-protected: clients send the Supabase anon JWT in Authorization.
//
// Local:  supabase functions serve consumer-web-reverse-geocode
// Deploy: supabase functions deploy consumer-web-reverse-geocode

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import {
  cacheKey,
  geocodeStatus,
  type NearbyArea,
  pickAreaName,
  pickFormattedAddress,
  pickNearbyAreas,
  pickSuggestedName,
  type Precision,
  precisionDecimals,
  readPoint,
  readPrecision,
  reverseGeocodeUrl,
  snapPoint,
} from "../_shared/reverse-geocode.ts";

/** What one snapped point answers. Null = Google had none. */
type Answer = {
  name: string | null;
  areas: NearbyArea[];
  suggestedName: string | null;
  formattedAddress: string | null;
};

/** Snapped point → answer, one map per precision so pin traffic never pushes
 *  the header's answers out. Bounded, oldest out. */
const caches: Record<Precision, Map<string, Answer>> = { std: new Map(), pin: new Map() };
const CACHE_MAX = 2000;
const GOOGLE_TIMEOUT_MS = 4000;

serveJson("consumer-web-reverse-geocode", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<{ lat?: unknown; lng?: unknown; precision?: unknown }>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const point = readPoint(bodyRes.body);
  if (!point) return json({ ok: false, code: "bad_point", error: "Send a finite lat and lng." }, 400);
  const precision = readPrecision(bodyRes.body);
  if (!precision) {
    return json({ ok: false, code: "bad_precision", error: 'precision must be "pin" or omitted' }, 400);
  }
  if (precision === "pin") {
    const { user } = await getOptionalAuthedUser(req, envRes.env);
    if (!user) return json({ ok: false, code: "sign_in_required", error: "Sign in to name a pin." }, 401);
  }

  const snapped = snapPoint(point.lat, point.lng, precisionDecimals(precision));
  const key = cacheKey(snapped, precision);
  const cache = caches[precision];
  const kept = cache.get(key);
  if (kept) return reply(kept, precision);

  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;

  let payload: unknown;
  try {
    const res = await fetch(reverseGeocodeUrl(snapped, keyRes.key, precision), {
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    payload = await res.json();
  } catch (err) {
    console.error(
      `[consumer-web-reverse-geocode] google (precision ${precision}):`,
      err instanceof Error ? err.message : err,
    );
    return json({ ok: false, code: "google_unreachable" }, 502);
  }

  const status = geocodeStatus(payload);
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    // REQUEST_DENIED means the key lacks the Geocoding API; never cached.
    const message = (payload as { error_message?: unknown })?.error_message;
    console.error(
      `[consumer-web-reverse-geocode] google status ${status} (precision ${precision})`,
      typeof message === "string" ? message : "",
    );
    return json({ ok: false, code: `google_${status.toLowerCase()}` }, 502);
  }

  const answer: Answer = {
    name: pickAreaName(payload),
    areas: pickNearbyAreas(payload),
    suggestedName: pickSuggestedName(payload),
    formattedAddress: pickFormattedAddress(payload),
  };
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, answer);
  return reply(answer, precision);
});

/** A std answer keeps its MESITA-2466 rule (a name or an area); a pin answer
 *  is useful with any of its four parts. */
function reply(answer: Answer, precision: Precision): Response {
  const { name, areas, suggestedName, formattedAddress } = answer;
  const useful = precision === "pin"
    ? Boolean(name || areas.length > 0 || suggestedName || formattedAddress)
    : Boolean(name || areas.length > 0);
  return useful
    ? json({ ok: true, name, areas, suggestedName, formattedAddress })
    : json({ ok: false, code: "no_area_name" });
}

// Supabase Edge Function — consumer-web-reverse-geocode (product caller)
//
// Home's location sheet names where the guest stands (MESITA-2466): the
// Current location row reads "Current location · Tecnológico". POST
// `{ lat, lng }` → `{ ok: true, name }` (the most local of neighbourhood ·
// sublocality · city) or `{ ok: false, code }`.
//
// One Google Geocoding (reverse) call per point snapped to ~110 m; repeats
// in this isolate come from the cache below, and the client keeps each
// answer for the visit. Wire status stays 200: supabase-js's invoke helper
// swallows non-2xx bodies.
//
// JWT-protected: clients send the Supabase anon JWT in Authorization.
//
// Local:  supabase functions serve consumer-web-reverse-geocode
// Deploy: supabase functions deploy consumer-web-reverse-geocode

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { readEFEnv } from "../_shared/auth.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import {
  geocodeStatus,
  pickAreaName,
  pointKey,
  readPoint,
  reverseGeocodeUrl,
  snapPoint,
} from "../_shared/reverse-geocode.ts";

/** Snapped point → name (null = Google had none). Bounded, oldest out. */
const cache = new Map<string, string | null>();
const CACHE_MAX = 2000;
const GOOGLE_TIMEOUT_MS = 4000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<{ lat?: unknown; lng?: unknown }>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const point = readPoint(bodyRes.body);
  if (!point) return json({ ok: false, code: "bad_point", error: "Send a finite lat and lng." });

  const snapped = snapPoint(point.lat, point.lng);
  const key = pointKey(snapped);
  if (cache.has(key)) return reply(cache.get(key) ?? null);

  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;

  let payload: unknown;
  try {
    const res = await fetch(reverseGeocodeUrl(snapped, keyRes.key), {
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    payload = await res.json();
  } catch (err) {
    console.error(
      "[consumer-web-reverse-geocode] google:",
      err instanceof Error ? err.message : err,
    );
    return json({ ok: false, code: "google_unreachable" });
  }

  const status = geocodeStatus(payload);
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    // REQUEST_DENIED means the key lacks the Geocoding API; never cached.
    const message = (payload as { error_message?: unknown })?.error_message;
    console.error(
      `[consumer-web-reverse-geocode] google status ${status}`,
      typeof message === "string" ? message : "",
    );
    return json({ ok: false, code: `google_${status.toLowerCase()}` });
  }

  const name = pickAreaName(payload);
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, name);
  return reply(name);
});

function reply(name: string | null): Response {
  return name
    ? json({ ok: true, name })
    : json({ ok: false, code: "no_area_name" });
}

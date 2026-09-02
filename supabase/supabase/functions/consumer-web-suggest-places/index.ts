// Supabase Edge Function — consumer-web-suggest-places (product caller)
//
// Consumer Search name-bar. Fast = Autocomplete (default). Deep = Partners
// · Mesita · Google after idle, one list after dropping overlaps.
// Autocomplete and Text Search never take a country — both stay Any.
// Membership is a boolean `partner` on each row; the client paints the
// point and never shows source section labels. Admin Manage Single Place
// uses the same lane (deep). Business suggest still uses suggestPlaces.
// Word answers with TWO entities (MESITA-1403): this caller alone opts
// into Location rows (`kind: "location"`), and `anchorPlaceId` resolves a
// picked Location's coordinates + viewport — one Details call per pick.
//
// JWT-protected: clients send the Supabase anon JWT in Authorization.
// Anonymous (anon key only, no user session) still get predictions.
//
// Local:  supabase functions serve consumer-web-suggest-places
// Deploy: supabase functions deploy consumer-web-suggest-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { readEFEnv } from "../_shared/auth.ts";
import {
  runConsumerSearchLane,
  runLocationAnchor,
} from "../_shared/consumer-search-lane.ts";

type Body = {
  input?: string;
  sessionToken?: string;
  lat?: number;
  lng?: number;
  country?: string;
  mode?: string;
  /** A picked Location's Google place id — anchor resolve, not a search. */
  anchorPlaceId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  if (typeof body.anchorPlaceId === "string" && body.anchorPlaceId.trim()) {
    return await runLocationAnchor(body.anchorPlaceId);
  }

  const lat = typeof body.lat === "number" && Number.isFinite(body.lat)
    ? body.lat
    : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng)
    ? body.lng
    : null;

  return await runConsumerSearchLane(env, "consumer-web-suggest-places", {
    input: body.input,
    sessionToken: body.sessionToken,
    lat,
    lng,
    mode: typeof body.mode === "string" ? body.mode : "fast",
    // Word alone answers with Locations (the matrix) — the admin caller
    // of this same lane stays Places-only.
    locations: true,
  });
});

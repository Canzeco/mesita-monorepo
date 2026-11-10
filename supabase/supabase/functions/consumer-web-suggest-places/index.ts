// Supabase Edge Function — consumer-web-suggest-places (product caller)
//
// Consumer Search name-bar. Fast = Autocomplete (default). Deep = Google
// Autocomplete + Text Search after idle, one list after dropping overlaps.
// A mode other than fast or deep is a 400 `unknown_mode`; Google failing on
// every query a mode ran is a 502, never an empty list (MESITA-2894).
// Autocomplete and Text Search never take a country — both stay Any.
// Membership is a boolean `enriched` on each row; the client paints the
// point and never shows source section labels. Admin Manage Single Place
// uses the same lane (deep). Business suggest and suggestPlaces were
// retired in MESITA-2090.
// Word answers with TWO entities (MESITA-1403): this caller alone opts
// into Location rows (`kind: "location"`), and `anchorPlaceId` resolves a
// picked Location's coordinates + viewport — one Details call per pick.
// `previewPlaceId` answers the Generate dialog's Google preview (photo,
// category, stars) — one Details call per dialog open (MESITA-2941).
//
// JWT-protected: clients send the Supabase anon JWT in Authorization.
// Anonymous (anon key only, no user session) still get predictions.
//
// Local:  supabase functions serve consumer-web-suggest-places
// Deploy: supabase functions deploy consumer-web-suggest-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { runConsumerNamePipeline } from "../_shared/name-pipeline.ts";
import { runLocationAnchor, runPlacePreview } from "./handlers.ts";

type Body = {
  input?: string;
  sessionToken?: string;
  lat?: number;
  lng?: number;
  mode?: unknown;
  /** A picked Location's Google place id — anchor resolve, not a search. */
  anchorPlaceId?: string;
  /** A Google-only place's id — the Generate dialog's preview (MESITA-2941). */
  previewPlaceId?: string;
};

serveJson("consumer-web-suggest-places", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  if (typeof body.anchorPlaceId === "string" && body.anchorPlaceId.trim()) {
    return await runLocationAnchor(body.anchorPlaceId);
  }
  if (typeof body.previewPlaceId === "string" && body.previewPlaceId.trim()) {
    return await runPlacePreview(body.previewPlaceId);
  }

  const lat = typeof body.lat === "number" && Number.isFinite(body.lat)
    ? body.lat
    : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng)
    ? body.lng
    : null;

  // Word alone answers with Locations (the matrix) — Admin Name stays
  // Places-only.
  return await runConsumerNamePipeline(env, {
    input: body.input,
    sessionToken: body.sessionToken,
    lat,
    lng,
    mode: body.mode == null ? "fast" : String(body.mode),
  });
});

// Supabase Edge Function — enricher-edgefunc-google-details (MESITA-3844)
//
// Enrich's step 1, Details: the same Google fetch and mapping Update runs
// (_shared/admin-google-place-update.ts::runGoogleDetailsStep), returned to
// Render and not written. Render folds the patch into the draft and commits
// once, as it does with enricher-edgefunc-sync-sources for Social and Reviews.
// So a place's Google facts are one body whichever button bought them.
//
// Body: { googlePlaceId: string, maxPhotos?: number }
// Response: { ok: true, patch, businessStatus, primaryType, photoUrls, countryCode }
//         | { ok: false, error, code? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireEnrichWriteRequest } from "../_shared/request.ts";
import { nonBlank } from "../_shared/input.ts";
import { googlePlacesKeyOrNull } from "../_shared/google-places.ts";
import { runGoogleDetailsStep } from "../_shared/admin-google-place-update.ts";

type Body = { googlePlaceId?: unknown; maxPhotos?: unknown };

serveJson("enricher-edgefunc-google-details", async (req) => {
  const ctx = requireEnrichWriteRequest(req);
  if (ctx instanceof Response) return ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const googlePlaceId = nonBlank(bodyRes.body.googlePlaceId);
  if (!googlePlaceId) return json({ ok: false, error: "googlePlaceId is required" }, 400);
  const raw = bodyRes.body.maxPhotos;
  const maxPhotos = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 10;

  const key = googlePlacesKeyOrNull(Deno.env);
  if (!key) return json({ ok: false, code: "no_key", error: "Google Places is not configured." }, 503);

  const step = await runGoogleDetailsStep(googlePlaceId, key, { maxPhotos });
  if (!step.ok) return json({ ok: false, error: step.error, code: step.code ?? null }, step.status);
  return json(step);
});

// Supabase Edge Function — enricher-edgefunc-sync-sources
//
// The same Sync the Reviews button persists, returned to Render and not
// written. Render folds the patch into the draft and commits once.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireEnrichWriteRequest } from "../_shared/request.ts";
import { runPlaceSync } from "../_shared/place-sync-run.ts";
import { nonBlank } from "../_shared/input.ts";

type Body = {
  googlePlaceId?: unknown;
  instagramUrl?: unknown;
  facebookUrl?: unknown;
};

serveJson("enricher-edgefunc-sync-sources", async (req) => {
  const ctx = requireEnrichWriteRequest(req);
  if (ctx instanceof Response) return ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const synced = await runPlaceSync({
    googlePlaceId: nonBlank(bodyRes.body.googlePlaceId),
    instagramUrl: nonBlank(bodyRes.body.instagramUrl),
    facebookUrl: nonBlank(bodyRes.body.facebookUrl),
  });
  return json({
    ok: true,
    lastSyncedAt: synced.lastSyncedAt,
    sources: synced.sources.map((row) => ({
      source: row.source,
      status: row.status,
      error: row.error,
    })),
    patch: synced.patch,
  });
});

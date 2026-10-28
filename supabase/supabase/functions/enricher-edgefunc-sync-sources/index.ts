// Supabase Edge Function — enricher-edgefunc-sync-sources
//
// The same Sync the Reviews button persists, returned to Render and not
// written. Render folds the patch into the draft and commits once.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { timingSafeEqual } from "../_shared/timing-safe-equal.ts";
import { runPlaceSync } from "../_shared/place-sync-run.ts";

type Body = {
  googlePlaceId?: unknown;
  instagramUrl?: unknown;
  facebookUrl?: unknown;
};

function link(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

serveJson("enricher-edgefunc-sync-sources", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const writeKey = Deno.env.get("ENRICH_WRITE_KEY")?.trim() ?? "";
  if (!writeKey) return json({ ok: false, error: "Server misconfigured" }, 500);
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || !timingSafeEqual(token, writeKey)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const synced = await runPlaceSync({
    googlePlaceId: link(bodyRes.body.googlePlaceId),
    instagramUrl: link(bodyRes.body.instagramUrl),
    facebookUrl: link(bodyRes.body.facebookUrl),
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

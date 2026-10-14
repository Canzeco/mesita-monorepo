// Supabase Edge Function — enricher-edgefunc-write-place
//
// The one writer Render calls. Render is the agent and does not hold a
// database key. This function writes the finished profile and
// content_state = ready through the profiles view, which is one Postgres
// statement. A body that is not a finished enrichment is refused and no
// row changes.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { validateProfilePatch, writePlace } from "../_shared/place-doc.ts";
import { mirrorPlacePhotos } from "../_shared/store-place-images.ts";
import { timingSafeEqual } from "../_shared/timing-safe-equal.ts";
import { enrichmentCommit } from "./commit.ts";
import { galleryUrls } from "./photos.ts";

Deno.serve(async (req) => {
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

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const bodyRes = await readJson<unknown>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const commit = enrichmentCommit(bodyRes.body);
  if (!commit.ok) return json({ ok: false, error: commit.error }, 400);
  const validated = validateProfilePatch(commit.patch);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 400);

  const admin = adminClient(envRes.env);
  let patch = validated.patch;
  const gallery = galleryUrls(patch.photos);
  if (gallery.length > 0) {
    const durable = await mirrorPlacePhotos(admin, envRes.env.url, gallery);
    if (durable.length > 0) patch = { ...patch, photos: durable };
    else {
      const { photos: _drop, ...without } = patch;
      patch = without;
    }
  }
  const written = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: commit.placeId,
    patch,
  });
  if (!written.ok) return json({ ok: false, error: written.error }, 500);
  return json({ ok: true, placeId: commit.placeId, content_state: "ready" });
});

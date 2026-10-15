// Supabase Edge Function — enricher-edgefunc-write-place
//
// The one writer Render calls. Render is the agent and does not hold a
// database key. This function writes the finished profile and
// content_state = ready through the profiles view. google_found,
// instagram_found, and facebook_found are not columns of that view, so
// they are written to place_profiles after it. A body that is not a
// finished enrichment is refused and no row changes. A stop is the other
// accepted body: the task sends it when the run fails, before it exits,
// and enriching turns off.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { validateProfilePatch, writePlace } from "../_shared/place-doc.ts";
import { mirrorPlacePhotos } from "../_shared/store-place-images.ts";
import { timingSafeEqual } from "../_shared/timing-safe-equal.ts";
import { enrichmentCommit } from "./commit.ts";
import { withoutFoundFlags } from "./found-flags.ts";
import { galleryUrls } from "./photos.ts";
import { contentStateAfterStop, enrichmentStop } from "./stop.ts";

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

  const admin = adminClient(envRes.env);
  const stop = enrichmentStop(bodyRes.body);
  if (stop.kind === "invalid") return json({ ok: false, error: stop.error }, 400);
  if (stop.kind === "stop") {
    const { data, error } = await admin
      .from("profiles")
      .select("content_state, enriched_at")
      .eq("id", stop.placeId)
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    const next = contentStateAfterStop({
      content_state: (data?.content_state ?? null) as string | null,
      enriched_at: (data?.enriched_at ?? null) as string | null,
    });
    if (!next) {
      return json({ ok: true, placeId: stop.placeId, content_state: data?.content_state ?? null });
    }
    // The read above picks ready or failed. The write itself matches only a
    // row that is still generating, so a finish that landed in between is
    // not overwritten.
    const cleared = await writePlace(admin, {
      table: "places",
      mode: "update",
      id: stop.placeId,
      patch: { content_state: next },
      onlyWhile: "generating",
      select: "content_state",
      selectMode: "maybeSingle",
    });
    if (!cleared.ok) return json({ ok: false, error: cleared.error }, 500);
    if (!cleared.row) {
      return json({ ok: true, placeId: stop.placeId, content_state: null });
    }
    return json({ ok: true, placeId: stop.placeId, content_state: next });
  }

  const commit = enrichmentCommit(bodyRes.body);
  if (!commit.ok) return json({ ok: false, error: commit.error }, 400);
  const validated = validateProfilePatch(commit.patch);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 400);

  let patch = validated.patch;
  const gallery = galleryUrls(patch.photos);
  if (gallery.length === 0) {
    const { photos: _drop, ...without } = patch;
    patch = without;
  } else if (!commit.mirrorPhotos) {
    patch = { ...patch, photos: gallery };
  } else {
    const durable = await mirrorPlacePhotos(admin, envRes.env.url, gallery);
    if (durable.length > 0) patch = { ...patch, photos: durable };
    else {
      const { photos: _drop, ...without } = patch;
      patch = without;
    }
  }
  const split = withoutFoundFlags(patch);
  const written = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: commit.placeId,
    patch: split.profile,
  });
  if (!written.ok) return json({ ok: false, error: written.error }, 500);
  if (Object.keys(split.found).length > 0) {
    const flags = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: commit.placeId,
      patch: split.found,
    });
    if (!flags.ok) return json({ ok: false, error: flags.error }, 500);
  }
  return json({ ok: true, placeId: commit.placeId, content_state: "ready" });
});

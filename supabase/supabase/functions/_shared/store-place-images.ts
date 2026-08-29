// Shared place-image persistence — upserts place_media_assets rows, then
// mirrors source URLs into the place-images bucket.
//
// CREATE Details awaits storeFirstPlaceImage (one Google photo, now) so a
// Created place has a thumb before Enrich Images. Enrich Images still uses
// storePlaceImages + runInBackground for the ranked gallery, via
// supabase-edgefunc-store-place-images (own wall clock).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { dedup } from "./parse-utils.ts";
import { runInBackground } from "./enrich-pipeline.ts";
import { writePlace } from "./place-doc.ts";
import {
  type AssetRow,
  extFor,
  imageIdFromPath,
  type PlaceImageAssetInput,
  sanitiseAssets,
  sanitiseUrls,
} from "./store-place-images-sanitize.ts";

export type { PlaceImageAssetInput, SourceKind } from "./store-place-images-sanitize.ts";
export {
  extFor,
  imageIdFromPath,
  isHttpUrl,
  sanitiseAssets,
  sanitiseUrls,
} from "./store-place-images-sanitize.ts";

const IMAGE_BUCKET = "place-images";
const MAX_FETCH_BYTES = 12_000_000;
const FETCH_TIMEOUT_MS = 15_000;
const PLACE_PHOTOS_CAP = 50;

export type StorePlaceImagesResult =
  | { ok: true; queued: number; preferred: number }
  | { ok: false; error: string };

/**
 * CREATE Details: mirror ONE Google photo now so a Created (not-yet-Enriched)
 * place still has a thumb in the app. Awaits the upload. Enrich Images later
 * replaces this with the ranked gallery. Mirror failure keeps the source URL.
 */
export async function storeFirstPlaceImage(
  admin: SupabaseClient,
  supabaseUrl: string,
  projectId: string,
  sourceUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string; url: string }> {
  const assets = sanitiseAssets([{ source: "google", source_url: sourceUrl }]);
  const url = assets[0]?.source_url ?? "";
  if (!url) {
    return { ok: false, error: "invalid_source_url", url: sourceUrl };
  }

  const { error: upsertErr } = await admin
    .from("place_media_assets")
    .upsert(
      [{
        place_id: projectId,
        source: "google",
        source_url: url,
        status: "pending",
        likes_count: null,
        caption: null,
        analysis_text: null,
        source_metadata: { via: "create" },
        last_error: null,
      }],
      { onConflict: "place_id,source_url" },
    );
  if (upsertErr) {
    return { ok: false, error: `media_upsert: ${upsertErr.message}`, url };
  }

  const mirrored = await mirrorOne(admin, supabaseUrl, url);
  const { error: updateErr } = await admin
    .from("place_media_assets")
    .update({
      status: mirrored.ok ? "saved" : "failed",
      storage_path: mirrored.path,
      public_url: mirrored.publicUrl,
      mime_type: mirrored.contentType,
      bytes: mirrored.bytes,
      last_error: mirrored.error,
    })
    .eq("place_id", projectId)
    .eq("source_url", url);
  if (updateErr) {
    console.error("[store-first-place-image] asset_update:", updateErr.message);
  }

  const finalUrl = mirrored.ok ? mirrored.url : url;
  const placeRes = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: projectId,
    patch: { photos: [finalUrl] },
  });
  if (!placeRes.ok) {
    return { ok: false, error: `place_update: ${placeRes.error}`, url: finalUrl };
  }
  if (!mirrored.ok) {
    return { ok: false, error: mirrored.error ?? "mirror_failed", url: finalUrl };
  }
  return { ok: true, url: finalUrl };
}

/** Upsert metadata rows and kick off background mirroring. */
export async function storePlaceImages(
  admin: SupabaseClient,
  supabaseUrl: string,
  projectId: string,
  rawAssets: PlaceImageAssetInput[],
  preferredPhotoUrls: string[] = [],
): Promise<StorePlaceImagesResult> {
  const assets = sanitiseAssets(rawAssets);
  const preferred = sanitiseUrls(preferredPhotoUrls);
  if (assets.length === 0) {
    return { ok: true, queued: 0, preferred: preferred.length };
  }

  const upsertRows = assets.map((a) => ({
    place_id: projectId,
    source: a.source,
    source_url: a.source_url,
    status: "pending",
    likes_count: a.likes_count,
    caption: a.caption,
    analysis_text: a.analysis_text,
    source_metadata: a.source_metadata,
    last_error: null,
  }));

  const { error: upsertErr } = await admin
    .from("place_media_assets")
    .upsert(upsertRows, { onConflict: "place_id,source_url" });
  if (upsertErr) {
    return { ok: false, error: `media_upsert: ${upsertErr.message}` };
  }

  runInBackground(processAssetsInBackground(admin, supabaseUrl, projectId, assets, preferred));
  return { ok: true, queued: assets.length, preferred: preferred.length };
}

async function processAssetsInBackground(
  admin: SupabaseClient,
  supabaseUrl: string,
  projectId: string,
  assets: AssetRow[],
  preferredPhotoUrls: string[],
) {
  const mirroredBySource = new Map<string, string>();

  for (const asset of assets) {
    const mirrored = await mirrorOne(admin, supabaseUrl, asset.source_url);
    mirroredBySource.set(asset.source_url, mirrored.url);
    const { error } = await admin
      .from("place_media_assets")
      .update({
        status: mirrored.ok ? "saved" : "failed",
        storage_path: mirrored.path,
        public_url: mirrored.publicUrl,
        mime_type: mirrored.contentType,
        bytes: mirrored.bytes,
        last_error: mirrored.error,
      })
      .eq("place_id", projectId)
      .eq("source_url", asset.source_url);
    if (error) {
      console.error("[store-place-images] asset_update:", error.message);
    }
  }

  const preferred = preferredPhotoUrls.length > 0
    ? preferredPhotoUrls
    : assets.map((a) => a.source_url);
  const finalPhotos = dedup(
    preferred.map((url) => mirroredBySource.get(url) ?? url),
  ).slice(0, PLACE_PHOTOS_CAP);
  if (finalPhotos.length === 0) return;

  const placeRes = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: projectId,
    patch: { photos: finalPhotos },
  });
  if (!placeRes.ok) {
    console.error("[store-place-images] place_update:", placeRes.error);
  }
}

async function mirrorOne(
  admin: SupabaseClient,
  supabaseUrl: string,
  sourceUrl: string,
): Promise<{
  ok: boolean;
  url: string;
  imageId: string | null;
  path: string | null;
  publicUrl: string | null;
  contentType: string | null;
  bytes: number | null;
  error: string | null;
}> {
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  if (sourceUrl.startsWith(publicPrefix)) {
    const existingPath = sourceUrl.slice(publicPrefix.length);
    return {
      ok: true,
      url: sourceUrl,
      imageId: imageIdFromPath(existingPath),
      path: existingPath,
      publicUrl: sourceUrl,
      contentType: null,
      bytes: null,
      error: null,
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sourceUrl, { signal: ctrl.signal });
    if (!res.ok) {
      return {
        ok: false,
        url: sourceUrl,
        imageId: null,
        path: null,
        publicUrl: null,
        contentType: null,
        bytes: null,
        error: `fetch_http_${res.status}`,
      };
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return {
        ok: false,
        url: sourceUrl,
        imageId: null,
        path: null,
        publicUrl: null,
        contentType,
        bytes: null,
        error: "not_image",
      };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FETCH_BYTES) {
      return {
        ok: false,
        url: sourceUrl,
        imageId: null,
        path: null,
        publicUrl: null,
        contentType,
        bytes: bytes.byteLength,
        error: "invalid_size",
      };
    }

    const imageId = await hashBytes(bytes);
    const path = `images/${imageId}.${extFor(contentType)}`;
    const { error: uploadErr } = await admin.storage
      .from(IMAGE_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadErr) {
      return {
        ok: false,
        url: sourceUrl,
        imageId: null,
        path: null,
        publicUrl: null,
        contentType,
        bytes: bytes.byteLength,
        error: `upload_${uploadErr.message}`,
      };
    }
    const publicUrl = `${publicPrefix}${path}`;
    return {
      ok: true,
      url: publicUrl,
      imageId,
      path,
      publicUrl,
      contentType,
      bytes: bytes.byteLength,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      url: sourceUrl,
      imageId: null,
      path: null,
      publicUrl: null,
      contentType: null,
      bytes: null,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function hashBytes(input: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", input as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

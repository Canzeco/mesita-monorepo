// Every photo we store is saved in three sizes next to its original
// (MESITA-2966): `<path>@160.webp`, `@640.webp`, `@1280.webp`. Screens load
// the size they draw instead of the full file. The stored URL stays the
// original; clients derive a size with `photoUrl` (packages/place-profile).
//
// The sizes come from Supabase Storage image transformations, fetched once
// here and uploaded, so a screen never pays for a resize. A failure keeps the
// original only: clients fall back to it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const PHOTO_WIDTHS = [160, 640, 1280] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

const QUALITY = 75;
const FETCH_TIMEOUT_MS = 20_000;

/** `images/abc.jpg` → `images/abc.jpg@640.webp`. Mirrors photoUrl. */
export function sizePath(path: string, width: PhotoWidth): string {
  return `${path}@${width}.webp`;
}

/** Is this object one of the saved sizes, not an original? */
export function isSizePath(path: string): boolean {
  return /@\d+\.webp$/.test(path);
}

export function renderUrl(
  supabaseUrl: string,
  bucket: string,
  path: string,
  width: PhotoWidth,
): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/render/image/public/${bucket}/${path}?width=${width}&resize=contain&quality=${QUALITY}`;
}

export type PhotoSizesResult = { saved: number; errors: string[] };

/** Render and upload the three sizes of one stored original. Never throws. */
export async function savePhotoSizes(
  admin: SupabaseClient,
  supabaseUrl: string,
  bucket: string,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PhotoSizesResult> {
  if (isSizePath(path)) return { saved: 0, errors: [] };
  const results = await Promise.all(PHOTO_WIDTHS.map(async (width) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(renderUrl(supabaseUrl, bucket, path, width), {
        headers: { Accept: "image/webp" },
        signal: ctrl.signal,
      });
      if (!res.ok) return `${width}: render_http_${res.status}`;
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (type !== "image/webp") return `${width}: render_type_${type || "none"}`;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) return `${width}: render_empty`;
      const { error } = await admin.storage.from(bucket).upload(
        sizePath(path, width),
        bytes,
        { contentType: "image/webp", upsert: true, cacheControl: "31536000" },
      );
      return error ? `${width}: upload_${error.message}` : null;
    } catch (err) {
      return `${width}: ${err instanceof Error ? err.message : "failed"}`;
    } finally {
      clearTimeout(timer);
    }
  }));
  const errors = results.filter((e): e is string => e !== null);
  if (errors.length > 0) {
    console.warn("photo-sizes", bucket, path, errors.join("; "));
  }
  return { saved: PHOTO_WIDTHS.length - errors.length, errors };
}

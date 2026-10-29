// MESITA-2578 — the guest's photo comes from Instagram when they verify.
//
// Pato, 2026-10-21: "when Instagram is verified, copy the profile photo into
// our storage and use it, unless the guest already uploaded one."
//
// consumer-web-claim-instagram's `check` scrape (Apify's Instagram profile
// actor) already returns the profile photo's URL. Instagram's CDN links are
// signed and expire within days, so the app never points at them: the EF
// downloads the image and stores a COPY in consumer-avatars under the guest's
// own folder, named `instagram-{ms}.{ext}` so an Instagram copy can always be
// told apart from a photo the guest uploaded (`{ms}-{uuid}.{ext}`,
// MESITA-953).
//
// THE RULE: the copy becomes `consumers.avatar_url` whenever the guest left
// "Use my Instagram photo" on (consumers.use_instagram_photo, default true,
// MESITA-2585), over any current picture, an upload included (MESITA-3046:
// Pato's upload kept the copy out while the switch read "Your Mesita picture
// comes from your Instagram"). Re-verifying refreshes the copy and removes
// the older Instagram copies; an uploaded file stays in the bucket. Best
// effort: nothing here can fail a verification.
//
// ONE DOOR FOR BOTH PATHS: the bio check (consumer-web-claim-instagram, the
// Apify scrape's photo) and the DM webhook (meta-instagram-receive-message,
// Meta's profile_pic) both call adoptInstagramAvatar with the photo's URL.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writeConsumer } from "./consumer-doc.ts";
import { savePhotoSizes } from "./photo-sizes.ts";
import { errorMessage } from "./errors.ts";

export const AVATAR_BUCKET = "consumer-avatars";
/** The bucket's own limits (20260807200655_consumer_avatars_bucket.sql). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const FETCH_TIMEOUT_MS = 10_000;

/** The scraped profile's photo URL, HD first. Null when there is none. */
export function pickProfilePicUrl(profile: Record<string, unknown>): string | null {
  for (const key of ["profilePicUrlHD", "profilePicUrl"]) {
    const v = profile[key];
    if (typeof v === "string" && /^https:\/\//.test(v.trim())) return v.trim();
  }
  return null;
}

/** Where a guest's Instagram copy lives in the bucket. */
export function instagramAvatarPath(consumerId: string, ms: number, ext: string): string {
  return `${consumerId}/instagram-${ms}.${ext}`;
}

/** True when an avatar URL (or a bucket path) is one of this guest's Instagram copies. */
export function isInstagramAvatar(urlOrPath: string | null | undefined, consumerId: string): boolean {
  return typeof urlOrPath === "string" && urlOrPath.includes(`${consumerId}/instagram-`);
}

/** Does the guest's switch allow the Instagram photo? Anything but an
 *  explicit false is the default, on (MESITA-2585). */
export function photoAllowed(useInstagramPhoto: unknown): boolean {
  return useInstagramPhoto !== false;
}

/** The stored extension for an image content type, or null when the bucket refuses it. */
export function avatarExt(contentType: string | null): string | null {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return AVATAR_TYPES[type] ?? null;
}

export type InstagramAvatarResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; reason: string };

/**
 * Copies the scraped Instagram photo into consumer-avatars and, when the rule
 * allows, makes it the guest's avatar. Never throws.
 */
export async function adoptInstagramAvatar(
  admin: SupabaseClient,
  supabaseUrl: string,
  consumerId: string,
  photoUrl: string | null,
  now = Date.now(),
): Promise<InstagramAvatarResult> {
  try {
    const source = photoUrl && /^https:\/\//.test(photoUrl.trim()) ? photoUrl.trim() : null;
    if (!source) return { ok: false, reason: "no_photo" };

    const { data: row, error: readErr } = await admin
      .from("consumers")
      .select("use_instagram_photo")
      .eq("id", consumerId)
      .maybeSingle();
    if (readErr) return { ok: false, reason: `read_${readErr.message}` };
    const r = row as { use_instagram_photo?: boolean } | null;
    // The guest said no: only the handle and followers (MESITA-2585).
    if (!photoAllowed(r?.use_instagram_photo)) return { ok: false, reason: "photo_off" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let bytes: Uint8Array;
    let ext: string | null;
    let contentType: string;
    try {
      const res = await fetch(source, { signal: ctrl.signal });
      if (!res.ok) return { ok: false, reason: `fetch_http_${res.status}` };
      contentType = res.headers.get("content-type") ?? "";
      ext = avatarExt(contentType);
      if (!ext) return { ok: false, reason: "not_an_allowed_image" };
      bytes = new Uint8Array(await res.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
    if (bytes.byteLength === 0 || bytes.byteLength > AVATAR_MAX_BYTES) {
      return { ok: false, reason: "invalid_size" };
    }

    const path = instagramAvatarPath(consumerId, now, ext);
    const bucket = admin.storage.from(AVATAR_BUCKET);
    const { error: upErr } = await bucket.upload(path, bytes, {
      contentType: contentType.split(";")[0].trim(),
      upsert: true,
    });
    if (upErr) return { ok: false, reason: `upload_${upErr.message}` };
    // The three sizes screens load (MESITA-2966). A miss keeps the original.
    await savePhotoSizes(admin, supabaseUrl, AVATAR_BUCKET, path);
    const avatarUrl = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;

    const written = await writeConsumer(admin, {
      mode: "update",
      id: consumerId,
      patch: { avatar_url: avatarUrl },
    });
    if (!written.ok) return { ok: false, reason: `write_${written.error}` };

    // The older Instagram copies are orphans now. Their removal is
    // housekeeping: a failure leaves a file, never a broken avatar.
    const { data: files } = await bucket.list(consumerId, { limit: 100 });
    const stale = (files ?? [])
      .map((f) => `${consumerId}/${f.name}`)
      .filter((p) => isInstagramAvatar(p, consumerId) && !p.startsWith(path));
    if (stale.length > 0) await bucket.remove(stale);

    return { ok: true, avatarUrl };
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }
}

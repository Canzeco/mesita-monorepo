// Consumer profile photo upload helpers (MESITA-953) — mirrors
// apps/web-consumer/src/lib/avatar-upload.ts. Keep limits in sync.

import type { SupabaseClient } from '@supabase/supabase-js';

export const AVATAR_BUCKET = 'consumer-avatars';
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extForMime(mime: string): string | null {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

/** Guess MIME from an ImagePicker asset when the OS omits it. */
export function mimeFromUri(uri: string, declared?: string | null): string | null {
  const normalized =
    declared === 'image/jpg' ? 'image/jpeg' : declared ?? null;
  if (normalized && ALLOWED_AVATAR_MIME_TYPES.has(normalized)) return normalized;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

/** Returns an error message, or null when the file is allowed. */
export function validateAvatarBytes(
  size: number | null | undefined,
  mime: string | null,
): string | null {
  if (!mime || !ALLOWED_AVATAR_MIME_TYPES.has(mime)) {
    return 'Unsupported file type. Use JPG, PNG, or WEBP.';
  }
  if (size == null) return null; // some pickers omit size — bucket still enforces
  if (size > MAX_AVATAR_BYTES) {
    return `Photo is too large (${formatBytes(size)}). Max ${formatBytes(MAX_AVATAR_BYTES)}.`;
  }
  if (size <= 0) {
    return 'That file looks empty. Pick another photo.';
  }
  return null;
}

/** Upload avatar bytes and return the public URL. */
export async function uploadConsumerAvatar(
  client: SupabaseClient,
  userId: string,
  body: ArrayBuffer | Blob,
  mime: string,
): Promise<string> {
  const size =
    body instanceof Blob
      ? body.size
      : body.byteLength;
  const validationError = validateAvatarBytes(size, mime);
  if (validationError) throw new Error(validationError);

  const ext = extForMime(mime) ?? 'jpg';
  const path = `${userId}/${Date.now()}-${globalThis.crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, {
      upsert: false,
      contentType: mime,
      cacheControl: '31536000',
    });
  if (uploadError) {
    throw new Error(`Couldn't upload photo: ${uploadError.message}`);
  }

  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Couldn't resolve the uploaded photo URL.");
  }
  return data.publicUrl;
}

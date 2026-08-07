// Consumer profile photo upload helpers (MESITA-953).
//
// Flow: validate → Storage upload to consumer-avatars → return public URL →
// caller patches consumers.avatar_url via consumer-web-update-profile.
// Bucket + EF both reject anything outside JPG/PNG/WEBP ≤ 2 MB.

import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "consumer-avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_AVATAR_ACCEPT = Array.from(ALLOWED_AVATAR_MIME_TYPES).join(
  ",",
);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extForMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

/** Returns an error message, or null when the file is allowed. */
export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    return "Unsupported file type. Use JPG, PNG, or WEBP.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `Photo is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_AVATAR_BYTES)}.`;
  }
  if (file.size <= 0) {
    return "That file looks empty. Pick another photo.";
  }
  return null;
}

/** Upload a validated avatar and return its public URL. */
export async function uploadConsumerAvatar(
  client: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const ext = extForMime(file.type) ?? "jpg";
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "31536000",
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

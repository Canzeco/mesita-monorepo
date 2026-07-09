/** Shared image upload constraints — mirrors mesita-web-business place-upload-utils. */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const ALLOWED_IMAGE_ACCEPT = Array.from(ALLOWED_IMAGE_MIME_TYPES).join(",");

export const PLACE_IMAGES_BUCKET = "place-images";

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extForFile(file: File): string {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    default:
      break;
  }
  const raw = file.name.trim().toLowerCase();
  const fromName = raw.includes(".") ? raw.split(".").pop() : null;
  return fromName && /^[a-z0-9]+$/.test(fromName) ? fromName : "jpg";
}

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return "Unsupported file type. Use JPG, PNG, WEBP, or AVIF.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

/** Storage object path for a business/admin gallery upload. */
export function placeImageObjectPath(placeId: string, file: File): string {
  const ext = extForFile(file);
  return `business/${placeId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

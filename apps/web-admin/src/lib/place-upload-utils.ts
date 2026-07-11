/** Shared upload constraints — mirrors mesita-web-business place-upload-utils. */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const ALLOWED_IMAGE_ACCEPT = Array.from(ALLOWED_IMAGE_MIME_TYPES).join(",");

export const ALLOWED_MENU_MIME_TYPES = new Set([
  "application/pdf",
  ...ALLOWED_IMAGE_MIME_TYPES,
]);

export const ALLOWED_MENU_ACCEPT = Array.from(ALLOWED_MENU_MIME_TYPES).join(",");

export const PLACE_IMAGES_BUCKET = "place-images";

// Menu uploads go to their own buckets, separate from gallery photos and split
// by kind — images to menu-images, PDFs to menu-pdfs (see supabase migrations
// 20260711182000_menu_images_bucket + 20260711190000_menu_pdfs_bucket).
export const MENU_IMAGES_BUCKET = "menu-images";
export const MENU_PDFS_BUCKET = "menu-pdfs";

/** Menu uploads split by kind: PDFs to menu-pdfs, images to menu-images. */
export function bucketForMenuFile(file: File): string {
  return file.type === "application/pdf" ? MENU_PDFS_BUCKET : MENU_IMAGES_BUCKET;
}

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

export function validateMenuUploadFile(file: File): string | null {
  if (!ALLOWED_MENU_MIME_TYPES.has(file.type)) {
    return "Use a PDF or image (JPG, PNG, WEBP, AVIF).";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

export function extForMenuFile(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  return extForFile(file);
}

export function isDriveMenuUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(
      /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const host = parsed.hostname.toLowerCase();
    return host.includes("drive.google.com") || host.includes("docs.google.com");
  } catch {
    return false;
  }
}

/** Storage object path for a business/admin gallery upload. */
export function placeImageObjectPath(placeId: string, file: File): string {
  const ext = extForFile(file);
  return `business/${placeId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

/** Storage object path for a menu / catalog PDF (or image) upload. */
export function placeMenuObjectPath(placeId: string, file: File): string {
  const ext = extForMenuFile(file);
  return `business/${placeId}/catalog/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

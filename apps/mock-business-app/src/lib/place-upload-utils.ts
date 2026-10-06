// A SNAPSHOT of the image half of apps/web-business/src/lib/place-upload-utils.ts.
//
// The real file is ~230 lines, and all but this is about Supabase Storage:
// bucket names, object paths, menu PDF vs image routing, Drive preview URLs,
// orphan cleanup. None of it can exist here — an upload in this app never
// leaves the tab (see PlaceSection's `uploadPhoto`). What DOES survive is the
// pair of constraints the file input and the error line read, because those
// are the two things a reviewer can see.

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const ALLOWED_IMAGE_ACCEPT = Array.from(ALLOWED_IMAGE_MIME_TYPES).join(",");

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileSizeError(file: File): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_UPLOAD_BYTES)}.`;
}

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return "Unsupported file type. Use JPG, PNG, WEBP, or AVIF.";
  }
  return fileSizeError(file);
}

// A MENU takes a PDF too — it is a document, not a gallery tile, and the real
// editor routes PDFs to their own bucket for exactly that reason.
const ALLOWED_MENU_MIME_TYPES = new Set([
  "application/pdf",
  ...ALLOWED_IMAGE_MIME_TYPES,
]);

export const ALLOWED_MENU_ACCEPT = Array.from(ALLOWED_MENU_MIME_TYPES).join(",");

export function validateMenuUploadFile(file: File): string | null {
  if (!ALLOWED_MENU_MIME_TYPES.has(file.type)) {
    return "Use a PDF or image (JPG, PNG, WEBP, AVIF).";
  }
  return fileSizeError(file);
}

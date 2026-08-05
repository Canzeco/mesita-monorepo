export const MAX_PHOTOS = 10;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Gallery photos live in place-images; menu uploads go to their own buckets,
// split by kind — images to menu-images, PDFs to menu-pdfs (see supabase
// migrations 20260711182000_menu_images_bucket + 20260711190000_menu_pdfs_bucket).
const MENU_IMAGES_BUCKET = "menu-images";
const MENU_PDFS_BUCKET = "menu-pdfs";

/** Menu uploads split by kind: PDFs to menu-pdfs, images to menu-images. */
export function bucketForMenuFile(file: File): string {
  return file.type === "application/pdf"
    ? MENU_PDFS_BUCKET
    : MENU_IMAGES_BUCKET;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const ALLOWED_IMAGE_ACCEPT = Array.from(ALLOWED_IMAGE_MIME_TYPES).join(
  ",",
);

const ALLOWED_MENU_MIME_TYPES = new Set([
  "application/pdf",
  ...ALLOWED_IMAGE_MIME_TYPES,
]);

export const ALLOWED_MENU_ACCEPT = Array.from(ALLOWED_MENU_MIME_TYPES).join(
  ",",
);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extForFile(file: File): string {
  const fromMime = (() => {
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
        return null;
    }
  })();
  if (fromMime) return fromMime;
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
    return (
      host.includes("drive.google.com") || host.includes("docs.google.com")
    );
  } catch {
    return false;
  }
}

type MenuFileKind = "image" | "pdf" | "drive";

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;

/** Classify a menu URL for compact preview / viewer routing. */
export function detectMenuFileKind(url: string): MenuFileKind {
  const trimmed = url.trim();
  if (!trimmed) return "pdf";
  if (isDriveMenuUrl(trimmed)) return "drive";
  if (IMAGE_EXT.test(trimmed) || /\/menu-images\//i.test(trimmed))
    return "image";
  if (PDF_EXT.test(trimmed) || /\/menu-pdfs\//i.test(trimmed)) return "pdf";
  return "pdf";
}

/** Convert a Drive/Docs share link into an embeddable /preview URL when possible. */
export function drivePreviewUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || !isDriveMenuUrl(trimmed)) return null;
  try {
    const parsed = new URL(
      /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    const fileMatch = path.match(/\/file\/d\/([^/]+)/);
    if (fileMatch?.[1]) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    const id = parsed.searchParams.get("id");
    if (id) {
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    if (host.includes("docs.google.com")) {
      const docMatch = path.match(
        /\/(document|spreadsheets|presentation)\/d\/([^/]+)/,
      );
      if (docMatch?.[1] && docMatch[2]) {
        return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Storage object path for a menu / catalog PDF (or image) upload. */
export function placeMenuObjectPath(projectId: string, file: File): string {
  const ext = extForMenuFile(file);
  return `business/${projectId}/catalog/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

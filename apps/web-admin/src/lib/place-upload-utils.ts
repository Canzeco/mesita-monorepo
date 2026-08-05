/** Shared upload constraints — mirrors mesita-web-business place-upload-utils. */

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Mirrors business-web-update-project `MENU_MAX_COUNT`. */
export const MENU_MAX_COUNT = 20;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const ALLOWED_IMAGE_ACCEPT = Array.from(ALLOWED_IMAGE_MIME_TYPES).join(",");

const ALLOWED_MENU_MIME_TYPES = new Set([
  "application/pdf",
  ...ALLOWED_IMAGE_MIME_TYPES,
]);

export const ALLOWED_MENU_ACCEPT = Array.from(ALLOWED_MENU_MIME_TYPES).join(",");

export const PLACE_IMAGES_BUCKET = "place-images";

// Menu uploads go to their own buckets, separate from gallery photos and split
// by kind — images to menu-images, PDFs to menu-pdfs (see supabase migrations
// 20260711182000_menu_images_bucket + 20260711190000_menu_pdfs_bucket).
const MENU_IMAGES_BUCKET = "menu-images";
const MENU_PDFS_BUCKET = "menu-pdfs";

/** Menu uploads split by kind: PDFs to menu-pdfs, images to menu-images. */
export function bucketForMenuFile(file: File): string {
  return file.type === "application/pdf" ? MENU_PDFS_BUCKET : MENU_IMAGES_BUCKET;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extForFile(file: File): string {
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

export function validateMenuUploadFile(file: File): string | null {
  if (!ALLOWED_MENU_MIME_TYPES.has(file.type)) {
    return "Use a PDF or image (JPG, PNG, WEBP, AVIF).";
  }
  return fileSizeError(file);
}

function extForMenuFile(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  return extForFile(file);
}

function parseLooseUrl(trimmed: string): URL | null {
  try {
    return new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

export function isDriveMenuUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const parsed = parseLooseUrl(trimmed);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host.includes("drive.google.com") || host.includes("docs.google.com");
}

type MenuFileKind = "image" | "pdf" | "drive";

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;

/** Classify a menu URL for compact preview / viewer routing. */
export function detectMenuFileKind(url: string): MenuFileKind {
  const trimmed = url.trim();
  if (!trimmed) return "pdf";
  if (isDriveMenuUrl(trimmed)) return "drive";
  if (IMAGE_EXT.test(trimmed) || /\/menu-images\//i.test(trimmed)) return "image";
  if (PDF_EXT.test(trimmed) || /\/menu-pdfs\//i.test(trimmed)) return "pdf";
  return "pdf";
}

/** Convert a Drive/Docs share link into an embeddable /preview URL when possible. */
export function drivePreviewUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || !isDriveMenuUrl(trimmed)) return null;
  const parsed = parseLooseUrl(trimmed);
  if (!parsed) return null;
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

/** Parse a public menu-pdfs / menu-images URL into bucket + object path. */
export function parseMenuStorageRef(
  url: string,
): { bucket: string; path: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/public\/(menu-pdfs|menu-images)\/(.+)$/,
    );
    if (!match?.[1] || !match[2]) return null;
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

type MenuStorageClient = {
  storage: {
    from: (bucket: string) => {
      remove: (
        paths: string[],
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Best-effort delete of a menu Storage object. No-ops for Drive links and
 * non-Mesita URLs; never throws — cleanup must not block the editor.
 */
export async function removeMenuStorageObject(
  supabase: MenuStorageClient,
  url: string,
): Promise<void> {
  const ref = parseMenuStorageRef(url);
  if (!ref) return;
  try {
    await supabase.storage.from(ref.bucket).remove([ref.path]);
  } catch {
    // ignore
  }
}

/** Delete every Mesita menu Storage URL in `urls` that isn't in `keep`. */
export async function removeOrphanMenuStorageObjects(
  supabase: MenuStorageClient,
  urls: Iterable<string>,
  keep: Iterable<string>,
): Promise<void> {
  const keepSet = new Set(
    [...keep].map((u) => u.trim()).filter(Boolean),
  );
  const seen = new Set<string>();
  await Promise.all(
    [...urls].map(async (raw) => {
      const url = raw.trim();
      if (!url || keepSet.has(url) || seen.has(url)) return;
      if (!parseMenuStorageRef(url)) return;
      seen.add(url);
      await removeMenuStorageObject(supabase, url);
    }),
  );
}

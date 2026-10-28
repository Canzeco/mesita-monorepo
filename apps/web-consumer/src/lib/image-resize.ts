// Browser-side resize + WebP re-encode before a Storage upload (MESITA-2936).
// Twin: apps/web-admin/src/lib/image-resize.ts — keep the two identical.
//
// Storage keeps whatever bytes we send, so shrinking here is the only thing
// that stops a 40px avatar from downloading a multi-megabyte phone photo.
// Anything the browser can't decode (PDF, HEIC on Chrome, GIF animations) is
// returned unchanged so the caller's own type/size checks still decide.

type ResizeOptions = {
  /** Longest edge of the output, in pixels. */
  maxEdge: number;
  /** Centre-crop to a square before scaling (avatars). */
  square?: boolean;
  /** Encoder quality, 0–1. */
  quality?: number;
};

const DECODABLE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function renamed(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "image";
  return `${base}.${ext}`;
}

/**
 * Resize `file` to fit `maxEdge` and re-encode it as WebP (JPEG, or PNG when
 * the image has transparency, on browsers that can't encode WebP). Returns the
 * original file when it can't be decoded or when re-encoding wouldn't shrink it.
 */
export async function resizeImageFile(
  file: File,
  { maxEdge, square = false, quality = 0.8 }: ResizeOptions,
): Promise<File> {
  if (!DECODABLE.has(file.type) || typeof document === "undefined") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (square) {
      const side = Math.min(sw, sh);
      sx = Math.round((sw - side) / 2);
      sy = Math.round((sh - side) / 2);
      sw = side;
      sh = side;
    }
    const scale = Math.min(1, maxEdge / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);

    let blob = await canvasToBlob(canvas, "image/webp", quality);
    // Safari before 17 ignores the WebP request and hands back a PNG.
    if (!blob || blob.type !== "image/webp") {
      if (file.type !== "image/jpeg" && hasTransparency(ctx, w, h)) {
        blob = await canvasToBlob(canvas, "image/png", 1);
      } else {
        // JPEG has no alpha: paint any transparent edge white, not black.
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
      }
    }
    if (!blob) return file;

    const unchangedSize = !square && scale === 1;
    if (unchangedSize && blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], renamed(file.name, ext), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

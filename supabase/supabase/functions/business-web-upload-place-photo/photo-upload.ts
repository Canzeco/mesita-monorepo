// Pure checks behind business-web-upload-place-photo (MESITA-3504).

/** The largest photo Profile takes (the browser shrinks it first). */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type PhotoType = { mime: string; ext: string };

/** The image type the bytes are, never what the client claims: JPG, PNG or
 *  WEBP (place-images' allowed types), else null. Pure. */
export function sniffImageType(b: Uint8Array): PhotoType | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

/** Where the upload lands in place-images: under the place's own folder. */
export function photoObjectPath(placeId: string, ext: string, now = Date.now(), id = crypto.randomUUID()): string {
  return `business/${placeId}/${now}-${id}.${ext}`;
}

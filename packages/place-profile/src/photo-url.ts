// Every photo Mesita stores has three sizes saved next to its original
// (MESITA-2966): `<original>@160.webp`, `@640.webp`, `@1280.webp`. A screen
// asks for the size it draws. Any other URL (Google, Instagram, a blob
// preview) passes through untouched. Mirrors supabase _shared/photo-sizes.ts.

export type PhotoSize = "thumb" | "card" | "full";

const WIDTH: Record<PhotoSize, number> = { thumb: 160, card: 640, full: 1280 };

const STORED =
  /\/storage\/v1\/object\/public\/(place-images|consumer-avatars)\/[^?#]+$/;
const SIZED = /@\d+\.webp$/;

/** Is this one of our stored originals, the kind that has sizes? */
export function isStoredPhoto(url: string | null | undefined): url is string {
  return typeof url === "string" && STORED.test(url) && !SIZED.test(url);
}

/** The saved size of a stored photo; anything else unchanged. */
export function photoUrl(url: string, size: PhotoSize): string;
export function photoUrl(
  url: string | null | undefined,
  size: PhotoSize,
): string | null | undefined;
export function photoUrl(
  url: string | null | undefined,
  size: PhotoSize,
): string | null | undefined {
  return isStoredPhoto(url) ? `${url}@${WIDTH[size]}.webp` : url;
}

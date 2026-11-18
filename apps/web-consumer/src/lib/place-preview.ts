// THE PLACE'S LINK PREVIEW (Pato, 2026-11-18, MESITA-4334: "when i share
// the place, generally there is a link preview. please make that link
// preview beautiful"; picked C of three mocks). A shared /place/<slug> link
// unfurls with the place, not Mesita's generic card: its name as the title,
// one line under it, and a 1200×630 card (the photo across the top, a white
// band with the name, the line and the Mesita mark) at /og/place/<slug>.jpg.
// Pure, so the page's tags and the image say the same words.

import type { PlaceDetail } from "@mesita/place-profile";

/** The card's size: the standard large link preview. */
export const PLACE_PREVIEW_SIZE = { width: 1200, height: 630 } as const;

/** 8587 → "8.6K", 950 → "950". */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** "★ 4.7 (8.6K) · $$ · 🌮 Tacos · Tecnológico": what is known, in that
 *  order; a missing part is left out, never guessed. */
export function placePreviewLine(
  place: Pick<PlaceDetail, "google" | "price_level" | "families" | "zone">,
): string {
  const parts: string[] = [];
  const { rating, count } = place.google;
  if (rating != null) {
    parts.push(`★ ${rating.toFixed(1)}${count ? ` (${compactCount(count)})` : ""}`);
  }
  if (place.price_level) parts.push("$".repeat(place.price_level));
  const family = place.families[0];
  if (family) parts.push(`${family.emoji} ${family.label}`);
  if (place.zone?.trim()) parts.push(place.zone.trim());
  return parts.join(" · ");
}

/** Where the card image lives: a .jpg path, so the proxy's matcher skips it
 *  and a signed-out crawler reaches it. */
export function placePreviewImagePath(slugOrId: string): string {
  return `/og/place/${encodeURIComponent(slugOrId)}.jpg`;
}

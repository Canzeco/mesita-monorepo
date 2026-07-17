"use client";

import { ImageCarousel } from "@/components/consumer/ImageCarousel";
import type { PlaceDetail } from "@/lib/mock/place";

import { Box } from "./box";

// ── 2. Media (Place tab) ────────────────────────────────────────────────

export function MediaBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — gallery in the same bordered card as Location/Time
  // (not full-bleed). bare Box = border + rounded-2xl, no title chrome;
  // carousel fills the card edge-to-edge inside the clip.
  if (place.photos.length === 0) return null;
  return (
    <Box bare>
      <ImageCarousel
        photos={place.photos}
        alt={place.name}
        aspect="aspect-square"
        rounded="rounded-none"
      />
    </Box>
  );
}

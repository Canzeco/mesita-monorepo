"use client";

import { ImageCarousel } from "../ImageCarousel";
import type { PlaceDetail } from "../../place-detail";

import { Box } from "./box";

// ── 2. Media (Place tab) ────────────────────────────────────────────────

export function MediaBox({ place }: { place: PlaceDetail }) {
  // A TITLED BOX, "PHOTOS" (Pato, MESITA-3429: "put media inside a box,
  // call it photos ... i know that will require double margin, but thats
  // okey"): the same white card as every other box, its 16px padding round
  // the square carousel. It filled a bare card edge to edge until then.
  if (place.photos.length === 0) return null;
  return (
    <Box title="Photos">
      <ImageCarousel
        photos={place.photos}
        alt={place.name}
        aspect="aspect-square"
        rounded="rounded-lg"
      />
    </Box>
  );
}

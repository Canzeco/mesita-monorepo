// Swipe-card layout from exactly two inputs:
//   1. Photo natural dimensions (file pixels — naturalWidth × naturalHeight)
//   2. Measured card box dimensions (full card width × height)
// Never the on-screen image slot above the fields strip, never viewport size.

/**
 * TIWC — Tall Image, Wide Card: image covers the full card; fields overlay.
 * WITC — Wide Image, Tall Card: image top band + fields strip below.
 */
export type SwipeCardLayoutMode = "tiwc" | "witc";

export type SwipeCardLayoutInput = {
  /** Photo file width in px (HTMLImageElement.naturalWidth). */
  photoNaturalWidth: number;
  /** Photo file height in px (HTMLImageElement.naturalHeight). */
  photoNaturalHeight: number;
  /** Full swipe-card width in px. */
  cardWidth: number;
  /** Full swipe-card height in px. */
  cardHeight: number;
};

export type SwipeCardLayoutResult = {
  mode: SwipeCardLayoutMode;
  /** photoNaturalWidth ÷ photoNaturalHeight */
  imageRatio: number;
  /** cardWidth ÷ cardHeight */
  cardRatio: number;
  /** imageRatio ÷ cardRatio */
  imageCardRatio: number;
};

/**
 * WITC (split) when imageCardRatio ≥ WITC_THRESHOLD.
 *
 * imageCardRatio compares photo aspect to card aspect (1.0 = same shape).
 * Threshold is intentional bias above 1.0 so we don't split too eagerly.
 *
 * Typical portrait phone card ≈ 390×640 (cardRatio ~0.61):
 *   9:16  → imageCardRatio ~0.92  → TIWC (immersive default)
 *   3:4   → ~1.23                 → TIWC
 *   4:5   → ~1.31                 → TIWC (common IG venue photo)
 *   1:1   → ~1.64                 → WITC (square; split keeps fields clean)
 *   3:2   → ~2.46                 → WITC
 *   16:9  → ~2.92                 → WITC (landscape hero shots)
 *
 * 1.32 keeps portrait + 4:5 on full bleed; split kicks in for square and wider.
 * Lower → more WITC splits; raise → more TIWC full bleed.
 */
export const WITC_THRESHOLD = 1.32;

/**
 *   imageRatio     = photoNaturalW ÷ photoNaturalH
 *   cardRatio      = cardW ÷ cardH
 *   imageCardRatio = imageRatio ÷ cardRatio
 *
 * WITC — image band + fields strip below   when imageCardRatio ≥ WITC_THRESHOLD
 * TIWC — full-card image + overlay fields  otherwise
 */
export function resolveSwipeCardLayout({
  photoNaturalWidth,
  photoNaturalHeight,
  cardWidth,
  cardHeight,
}: SwipeCardLayoutInput): SwipeCardLayoutResult {
  const imageRatio = photoNaturalWidth / photoNaturalHeight;
  const cardRatio = cardWidth / Math.max(cardHeight, 1);
  const imageCardRatio = imageRatio / cardRatio;

  const mode: SwipeCardLayoutMode =
    imageCardRatio >= WITC_THRESHOLD ? "witc" : "tiwc";

  return { mode, imageRatio, cardRatio, imageCardRatio };
}

export function isFullBleedLayout(mode: SwipeCardLayoutMode): boolean {
  return mode === "tiwc";
}

export function isSplitLayout(mode: SwipeCardLayoutMode): boolean {
  return mode === "witc";
}

/** Bottom-center object-cover placement for the WITC shared photo plane. */
export type WitcCoverPlacement = {
  /** Scaled image width in px (may exceed card width). */
  width: number;
  /** Scaled image height in px (may exceed plane height). */
  height: number;
  /** Left offset within the card/plane in px. */
  left: number;
  /** Top offset within the card/plane in px (≤ 0 when bottom-flush). */
  top: number;
  /** photoNaturalWidth ÷ photoNaturalHeight */
  imageRatio: number;
  /** cardWidth ÷ planeHeight */
  cardRatio: number;
  /** True when imageRatio ≥ cardRatio → height hits the plane first (width overflows). */
  heightLimited: boolean;
};

export type WitcImageRegionOffsets = {
  left: number;
  top: number;
};

export type WitcCoverLayout = {
  placement: WitcCoverPlacement;
  /** Full-card plane height (same as measured card height). */
  planeHeight: number;
  /** Mirror / fields strip height. */
  stripHeight: number;
  /** Top photo band height (plane − strip). */
  topBandHeight: number;
  /** Row in the scaled image (px from image top) where top band meets mirror. */
  seamRowInImage: number;
  regions: {
    topBand: WitcImageRegionOffsets;
    mirrorStrip: WitcImageRegionOffsets;
  };
};

/**
 * CSS `background-size: cover` with `background-position: center bottom` on the
 * full card plane — expressed as one scaled image rect.
 *
 * Uses imageRatio vs cardRatio to pick the limiting axis:
 *   imageRatio ≥ cardRatio → height = planeHeight, width = planeHeight × imageRatio
 *   imageRatio <  cardRatio → width = cardWidth,  height = cardWidth ÷ imageRatio
 *
 * Bottom anchor: top = planeHeight − height, left centers horizontal overflow.
 */
export function computeWitcCoverPlacementFromRatios({
  imageRatio,
  cardRatio,
  cardWidth,
  planeHeight,
}: {
  imageRatio: number;
  cardRatio: number;
  cardWidth: number;
  planeHeight: number;
}): WitcCoverPlacement {
  const heightLimited = imageRatio >= cardRatio;

  const width = heightLimited ? planeHeight * imageRatio : cardWidth;
  const height = heightLimited ? planeHeight : cardWidth / imageRatio;
  const left = (cardWidth - width) / 2;
  const top = planeHeight - height;

  return {
    width,
    height,
    left,
    top,
    imageRatio,
    cardRatio,
    heightLimited,
  };
}

/** Natural pixel entry point — derives imageRatio, then same cover math as above. */
export function computeWitcCoverPlacement({
  photoNaturalWidth,
  photoNaturalHeight,
  cardWidth,
  planeHeight,
}: {
  photoNaturalWidth: number;
  photoNaturalHeight: number;
  cardWidth: number;
  planeHeight: number;
}): WitcCoverPlacement {
  const imageRatio = photoNaturalWidth / Math.max(photoNaturalHeight, 1);
  const cardRatio = cardWidth / Math.max(planeHeight, 1);

  return computeWitcCoverPlacementFromRatios({
    imageRatio,
    cardRatio,
    cardWidth,
    planeHeight,
  });
}

/**
 * Mirror strip reuses the same cover rect; only the containing clip changes.
 * mirrorStrip.top = placement.top − topBandHeight so the card-bottom anchor matches.
 */
export function computeWitcCoverLayout({
  photoNaturalWidth,
  photoNaturalHeight,
  cardWidth,
  planeHeight,
  stripHeight,
}: {
  photoNaturalWidth: number;
  photoNaturalHeight: number;
  cardWidth: number;
  planeHeight: number;
  stripHeight: number;
}): WitcCoverLayout {
  const placement = computeWitcCoverPlacement({
    photoNaturalWidth,
    photoNaturalHeight,
    cardWidth,
    planeHeight,
  });
  const topBandHeight = Math.max(planeHeight - stripHeight, 0);
  const seamRowInImage = topBandHeight - placement.top;

  return {
    placement,
    planeHeight,
    stripHeight,
    topBandHeight,
    seamRowInImage,
    regions: {
      topBand: { left: placement.left, top: placement.top },
      mirrorStrip: {
        left: placement.left,
        top: placement.top - topBandHeight,
      },
    },
  };
}

// Swipe-card layout from exactly two inputs:
//   1. Photo natural dimensions (file pixels — naturalWidth × naturalHeight)
//   2. Measured card box dimensions (full card width × height)
// Never the on-screen image slot above the fields strip, never viewport size.

/**
 * TIWC — Tall Image, Wide Card: image covers the full card; fields overlay.
 * WITC — Wide Image, Tall Card: image top band + fields strip below.
 */
export type SwipeCardLayoutMode = "tiwc" | "witc";

type SwipeCardLayoutInput = {
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
 *   4:5   → ~1.31                 → TIWC (common IG place photo)
 *   1:1   → ~1.64                 → WITC (square; split keeps fields clean)
 *   3:2   → ~2.46                 → WITC
 *   16:9  → ~2.92                 → WITC (landscape hero shots)
 *
 * 1.32 keeps portrait + 4:5 on full bleed; split kicks in for square and wider.
 * Lower → more WITC splits; raise → more TIWC full bleed.
 */
const WITC_THRESHOLD = 1.32;

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

export function isSplitLayout(mode: SwipeCardLayoutMode): boolean {
  return mode === "witc";
}

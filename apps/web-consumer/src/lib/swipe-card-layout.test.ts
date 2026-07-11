import {
  computeWitcCoverLayout,
  computeWitcCoverPlacementFromRatios,
  resolveSwipeCardLayout,
  WITC_THRESHOLD,
} from "./swipe-card-layout";

/** Typical portrait swipe card after shell chrome (~390×640). */
const PORTRAIT_CARD = { cardWidth: 390, cardHeight: 640 };

function assertMode(
  label: string,
  photoNaturalWidth: number,
  photoNaturalHeight: number,
  expected: "tiwc" | "witc",
  card = PORTRAIT_CARD,
) {
  const { mode, imageRatio, imageCardRatio } = resolveSwipeCardLayout({
    photoNaturalWidth,
    photoNaturalHeight,
    ...card,
  });
  if (mode !== expected) {
    throw new Error(
      `${label}: expected ${expected}, got ${mode} (imageRatio=${imageRatio.toFixed(2)}, imageCardRatio=${imageCardRatio.toFixed(2)})`,
    );
  }
}

assertMode("9:16 portrait", 1080, 1920, "tiwc");
assertMode("3:4 portrait", 1200, 1600, "tiwc");
assertMode("4:5 instagram", 1080, 1350, "tiwc");
assertMode("1:1 square", 1080, 1080, "witc");
assertMode("3:2 landscape", 1500, 1000, "witc");
assertMode("16:9 landscape", 1920, 1080, "witc");

// 16:9 on ~390×640 card — height-limited (imageRatio > cardRatio), bottom flush
{
  const planeHeight = 640;
  const stripHeight = 148;
  const cardWidth = 390;
  const imageRatio = 16 / 9;
  const cardRatio = cardWidth / planeHeight;

  const placement = computeWitcCoverPlacementFromRatios({
    imageRatio,
    cardRatio,
    cardWidth,
    planeHeight,
  });
  if (!placement.heightLimited) {
    throw new Error("16:9 on portrait card should be height-limited");
  }
  if (Math.abs(placement.top) > 0.01) {
    throw new Error(
      `height-limited cover should flush bottom: top=${placement.top}`,
    );
  }
  if (Math.abs(placement.height - planeHeight) > 0.01) {
    throw new Error(
      `height-limited cover height should match plane: ${placement.height}`,
    );
  }

  const layout = computeWitcCoverLayout({
    photoNaturalWidth: 1920,
    photoNaturalHeight: 1080,
    cardWidth,
    planeHeight,
    stripHeight,
  });
  const mirrorSliceBottom = layout.seamRowInImage + stripHeight;
  if (mirrorSliceBottom > layout.placement.height + 0.01) {
    throw new Error("mirror slice should fit inside scaled image");
  }
  if (
    Math.abs(
      layout.regions.mirrorStrip.top - (placement.top - layout.topBandHeight),
    ) > 0.01
  ) {
    throw new Error("mirror offset must shift by topBandHeight");
  }
}

// 1:1 square — height-limited on portrait card, horizontal crop via negative left
{
  const cardWidth = 390;
  const planeHeight = 640;
  const cardRatio = cardWidth / planeHeight;
  const placement = computeWitcCoverPlacementFromRatios({
    imageRatio: 1,
    cardRatio,
    cardWidth,
    planeHeight,
  });
  if (!placement.heightLimited) {
    throw new Error("square on portrait card should be height-limited");
  }
  if (Math.abs(placement.width - planeHeight) > 0.01) {
    throw new Error(
      `width should be planeHeight × imageRatio: ${placement.width}`,
    );
  }
  if (placement.left >= 0) {
    throw new Error(
      `horizontal crop should be negative left: ${placement.left}`,
    );
  }
}

// Tall image (width-limited) — top < 0, mirror still aligns at seam row
{
  const cardWidth = 390;
  const planeHeight = 640;
  const stripHeight = 148;
  const imageRatio = 0.5; // 1:2 portrait
  const cardRatio = cardWidth / planeHeight;

  const placement = computeWitcCoverPlacementFromRatios({
    imageRatio,
    cardRatio,
    cardWidth,
    planeHeight,
  });
  if (placement.heightLimited) {
    throw new Error("1:2 image on portrait card should be width-limited");
  }
  if (placement.top >= 0) {
    throw new Error(
      `width-limited cover should crop above: top=${placement.top}`,
    );
  }

  const layout = computeWitcCoverLayout({
    photoNaturalWidth: 500,
    photoNaturalHeight: 1000,
    cardWidth,
    planeHeight,
    stripHeight,
  });
  if (
    Math.abs(layout.seamRowInImage - (layout.topBandHeight - placement.top)) >
    0.01
  ) {
    throw new Error("seam row should match topBandHeight − placement.top");
  }
}

console.log("swipe-card-layout tests passed", { WITC_THRESHOLD });

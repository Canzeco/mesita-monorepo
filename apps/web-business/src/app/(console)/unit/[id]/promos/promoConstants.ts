import type { StrategyId } from "@/lib/business/strategies";

export const PRODUCT_PRICE_MXN = 1000;

// Sample ticket for the worked example — above the universal cap on purpose,
// so the "first MX$500" rule is visible in the math.
export const EXAMPLE_BILL_MXN = 700;

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text
// in pixels — copy stays HTML); the gradient paints behind the image so a
// slow or missing asset still renders a branded band. `meter`/`accent` carry
// the identity into the give/get meters that replaced the card's table.
export const CARD_ART: Record<
  StrategyId,
  { src: string; fallback: string; cta: string; meter: string; accent: string }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    meter: "bg-slate-400",
    accent: "text-slate-500",
  },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    meter: "bg-emerald-500",
    accent: "text-emerald-600",
  },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    meter: "bg-orange-500",
    accent: "text-orange-600",
  },
  // No art file yet — the gradient IS the fallback. Violet reads as the rung
  // above orange without colliding with anything else on the rail.
  dominant: {
    src: "/promos/strategy-dominant.jpg",
    fallback: "from-violet-900 to-fuchsia-500",
    cta: "from-violet-600 to-fuchsia-500",
    meter: "bg-violet-500",
    accent: "text-violet-600",
  },
};

export type CardArt = (typeof CARD_ART)[StrategyId];

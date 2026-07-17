import type { StrategyId } from "@/lib/business/strategies";

export const PRODUCT_PRICE_MXN = 1000;

// Sample ticket for the worked example — above the universal cap on purpose,
// so the "first MX$500" rule is visible in the math.
export const EXAMPLE_BILL_MXN = 700;

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text
// in pixels — copy stays HTML); the gradient paints behind the image so a
// slow or missing asset still renders a branded band.
// `meter`/`recvText`/`recvBg`/`recvBorder` also drive the "You receive" reward
// panel — the payoff, colored in the strategy's own accent (MESITA-592).
export const CARD_ART: Record<
  StrategyId,
  {
    src: string;
    fallback: string;
    cta: string;
    meter: string;
    recvText: string;
    recvBg: string;
    recvBorder: string;
  }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    meter: "bg-slate-400",
    recvText: "text-slate-500",
    recvBg: "bg-muted/40",
    recvBorder: "border-border",
  },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    meter: "bg-emerald-500",
    recvText: "text-emerald-600",
    recvBg: "bg-emerald-500/[0.07]",
    recvBorder: "border-emerald-500/25",
  },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    meter: "bg-orange-500",
    recvText: "text-orange-600",
    recvBg: "bg-orange-500/[0.07]",
    recvBorder: "border-orange-500/25",
  },
  dominant: {
    src: "/promos/strategy-dominant.jpg",
    fallback: "from-purple-950 to-amber-500",
    cta: "from-purple-700 via-fuchsia-600 to-amber-500",
    meter: "bg-purple-500",
    recvText: "text-purple-600",
    recvBg: "bg-purple-500/[0.07]",
    recvBorder: "border-purple-500/25",
  },
};

export type CardArt = (typeof CARD_ART)[StrategyId];

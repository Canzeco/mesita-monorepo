import { BRAND } from "@/generated/brand";

// Tokens, light only. Colors are named by meaning, so a dark set can be added
// without touching a screen. Values: Notion Docs › Apps › A2 §9.
export const colors = {
  page: "#f2f2f2",
  paper: "#ffffff",
  fill: "#efefef",

  ink: "#171717",
  muted: "#5c5c5c",
  border: "#dedede",
  onInk: "#ffffff",

  reserve: "#da3743",
  danger: "#e6000c",
  vip: "#e9c46a",
  onVip: "#141414",

  prepay: "#635bff",
  onPrepay: "#ffffff",
  pay: "#00d66f",
  onPay: "#0a0a0a",

  /** The mark, and nothing else. */
  brand: BRAND.pink,
} as const;

const fontFamily = "Inter";

/** Six roles, five sizes. A screen picks a role, never a size. */
export const type = {
  title: { fontFamily, fontSize: 24, lineHeight: 30, fontWeight: "600" },
  heading: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: "600" },
  body: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: "400" },
  label: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  caption: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: "400" },
  numeric: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 8, card: 12, panel: 24 } as const;

export const pressedOpacity = 0.7;

export const motion = { fast: 150, slow: 250 } as const;

/** Dynamic Type is on, up to this. */
export const maxFontSizeMultiplier = 1.3;

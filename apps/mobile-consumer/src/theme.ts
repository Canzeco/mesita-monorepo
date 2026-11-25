import { BRAND } from "@/generated/brand";

// Tokens, light only, named by meaning. Values are the web guest app's
// (apps/web-consumer globals.css), each oklch as its hex.
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
  /** Prepay bonus circles, darker as the percent rises. */
  bonus60: "#352cb8",
  bonus20: "#bdb9ff",
  bonusLow: "#e6e4ff",
  /** Pay percent boxes, darker as the percent rises. */
  pay10: "#85edb6",
  payLow: "#d3f8e2",
  /** Pay's Accepts Credits Yes, the web's blue box. */
  creditsYes: "#bfdbfe",
  pay: "#00d66f",
  onPay: "#0a0a0a",

  /** A place card's facts. Open wears the price's green. */
  price: "#008236",
  closed: "#e7000b",
  distance: "#155dfc",
  star: "#ffb900",

  /** On the sign-in photo. */
  phone: "#00a63e",
  photo: "#000000",
  onPhoto: "#ffffff",
  onPhotoSoft: "rgba(255, 255, 255, 0.8)",
  onPhotoFaint: "rgba(255, 255, 255, 0.5)",
  onPhotoFill: "rgba(255, 255, 255, 0.15)",

  /** Behind a window. */
  dim: "rgba(0, 0, 0, 0.45)",
  /** An icon's soft ground, ink at ten percent. */
  inkSoft: "rgba(23, 23, 23, 0.1)",

  /** A face with no photo: the sex's colour, age in white. */
  faceFemale: "#db2777",
  faceMale: "#2563eb",
  faceOther: "#000000",

  /** The mark, and nothing else. */
  brand: BRAND.pink,
} as const;

const fontFamily = "Inter";

/** The web's type steps. A screen picks a role, never a size. */
export const type = {
  hero: { fontFamily, fontSize: 32, lineHeight: 34, fontWeight: "600", letterSpacing: -0.6 },
  cover: { fontFamily, fontSize: 30, lineHeight: 33, fontWeight: "600", letterSpacing: -0.6 },
  title: { fontFamily, fontSize: 24, lineHeight: 30, fontWeight: "600" },
  heading: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: "600" },
  strong: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: "400" },
  label: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  small: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: "400" },
  note: { fontFamily, fontSize: 13, lineHeight: 20, fontWeight: "400" },
  button: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  caption: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: "400" },
  tag: { fontFamily, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  meta: { fontFamily, fontSize: 10, lineHeight: 14, fontWeight: "600" },
  numeric: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: "600", fontVariant: ["tabular-nums"] },
  code: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: "400", letterSpacing: 9 },
  /** The word Mesita. */
  wordmark: { fontFamily: "Outfit", fontSize: 30, lineHeight: 34, fontWeight: "700", letterSpacing: -0.9 },
  coverWordmark: { fontFamily: "Outfit", fontSize: 24, lineHeight: 28, fontWeight: "700", letterSpacing: -0.7 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 8, field: 12, phone: 14, card: 16, panel: 24 } as const;

export const pressedOpacity = 0.7;

export const motion = { fast: 150, slow: 250 } as const;

/** Dynamic Type is on, up to this. */
export const maxFontSizeMultiplier = 1.3;

/** The sign-in photo's veil: light at the top, clear over the faces, deep
 *  under the words. */
export const photoVeil = {
  colors: ["rgba(0,0,0,0.42)", "rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.72)", "rgba(0,0,0,0.9)"],
  stops: ["0%", "22%", "34%", "58%", "100%"],
} as const;

export const cardVeil = {
  colors: ["rgba(0,0,0,0.45)", "rgba(0,0,0,0)", "rgba(0,0,0,0.9)"],
  stops: ["0%", "30%", "100%"],
} as const;

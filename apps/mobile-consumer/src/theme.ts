import { BRAND } from "@/generated/brand";

// Tokens, light only, named by meaning. Values are the web guest app's
// (apps/web-consumer globals.css), each oklch as its hex.
export const colors = {
  page: "#f2f2f2",
  paper: "#ffffff",
  fill: "#efefef",

  ink: "#171717",
  muted: "#5d5d5d",
  border: "#dbdbdb",
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
  /** The seal after a place name. Premier is red; an ad slot is blue. */
  premier: "#f4212e",
  ad: "#1d9bf0",
  /** Google's four-colour G, its own colours (the web's BrandLogos). */
  googleYellow: "#fbbc05",
  googleRed: "#ea4335",
  googleGreen: "#34a853",
  googleBlue: "#4285f4",

  /** On the sign-in photo. */
  phone: "#00a63e",
  photo: "#000000",
  onPhoto: "#ffffff",
  onPhotoSoft: "rgba(255, 255, 255, 0.8)",
  onPhotoFaint: "rgba(255, 255, 255, 0.5)",
  onPhotoFill: "rgba(255, 255, 255, 0.15)",

  /** The spinner's track on an ink button (the web's white at 40%). */
  onInkTrack: "rgba(255, 255, 255, 0.4)",

  /** Behind a window. */
  dim: "rgba(0, 0, 0, 0.45)",
  /** A photo counter sitting on the picture. */
  scrim: "rgba(0, 0, 0, 0.55)",
  /** An icon's soft ground, ink at ten percent. */
  inkSoft: "rgba(23, 23, 23, 0.1)",

  /** A face with no photo: the sex's colour, age in white. */
  faceFemale: "#db2777",
  faceMale: "#2563eb",
  faceOther: "#000000",

  /** The mark, and nothing else. */
  brand: BRAND.pink,

  /** Pay's test-mode strip (the web's amber banner). */
  testBanner: "#fde68a",
  testBannerInk: "#451a03",

  /** Search map. Black places, red Premier, purple selected, blue for you. */
  mapPin: "#111111",
  mapSelected: "#7c3aed",
  mapYou: "#007aff",
  mapPremier: "#ff2357",
  mapWait: "#cdeec4",
  mapLand: "#f8f8f7",
  mapWater: "#b9dcf5",
  mapWaterInk: "#5d87a8",
  mapPoi: "#f1f1ef",
  mapCover: "#e2f2da",
  mapRoadEdge: "#e4e4e2",
  mapHighwayEdge: "#d9d9d6",
  mapLabel: "#9a9a9a",
  mapArea: "#7a7a7a",
  /** The search ring's whisper of white. */
  mapRing: "rgba(255,255,255,0.06)",
} as const;

/** The web Search basemap: light land, mint parks, roads, fewer names. */
export const searchMapStyle = [
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: colors.mapLand }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: colors.mapWater }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: colors.mapWaterInk }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: colors.mapPoi }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: colors.mapWait }] },
  { featureType: "landscape.natural.landcover", elementType: "geometry", stylers: [{ color: colors.mapCover }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: colors.paper }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: colors.mapRoadEdge }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: colors.paper }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: colors.mapHighwayEdge }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: colors.mapLabel }] },
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: colors.mapArea }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
];

const fontFamily = "Inter";

/** The web's weights: font-normal, font-semibold, font-bold. No medium. */
export const weight = { normal: "400", semibold: "600", bold: "700" } as const;

/** The web's tracking classes, in em: multiply by the font size. */
export const tracking = { tight: -0.025, eyebrow: 0.14 } as const;

/** The web's text classes in use: Tailwind's text-xs to text-5xl, then the
 *  type-* roles of globals.css. Size and line height, in points. */
export const text = {
  xs: { fontFamily, fontSize: 12, lineHeight: 16 },
  sm: { fontFamily, fontSize: 14, lineHeight: 20 },
  base: { fontFamily, fontSize: 16, lineHeight: 24 },
  lg: { fontFamily, fontSize: 18, lineHeight: 28 },
  xl: { fontFamily, fontSize: 20, lineHeight: 28 },
  "2xl": { fontFamily, fontSize: 24, lineHeight: 32 },
  "3xl": { fontFamily, fontSize: 30, lineHeight: 36 },
  "4xl": { fontFamily, fontSize: 36, lineHeight: 40 },
  "5xl": { fontFamily, fontSize: 48, lineHeight: 48 },
  meta: { fontFamily, fontSize: 10, lineHeight: 14 },
  label: { fontFamily, fontSize: 11, lineHeight: 15.4 },
  body: { fontFamily, fontSize: 13, lineHeight: 19.5 },
  eyebrow: {
    fontFamily,
    fontSize: 12,
    lineHeight: 15.6,
    fontWeight: weight.semibold,
    letterSpacing: 12 * tracking.eyebrow,
    textTransform: "uppercase",
  },
} as const;

/** The roles today's screens wear, each one a web class and a weight. A
 *  screen moves to `size` and `weight` in its own wave. */
export const type = {
  hero: { fontFamily, fontSize: 32, lineHeight: 33.28, fontWeight: weight.semibold, letterSpacing: -0.64 },
  cover: { fontFamily, fontSize: 30, lineHeight: 33, fontWeight: weight.semibold, letterSpacing: -0.6 },
  title: { ...text["2xl"], fontWeight: weight.semibold },
  heading: { ...text.lg, fontWeight: weight.semibold },
  strong: { ...text.base, fontWeight: weight.semibold },
  body: { ...text.base, fontWeight: weight.normal },
  label: { ...text.sm, fontWeight: weight.semibold },
  small: { ...text.sm, fontWeight: weight.normal },
  note: { ...text.body, fontWeight: weight.normal },
  button: { ...text.xs, fontWeight: weight.semibold },
  caption: { ...text.xs, fontWeight: weight.normal },
  tag: { ...text.label, fontWeight: weight.semibold },
  meta: { ...text.meta, fontWeight: weight.semibold },
  numeric: { ...text.base, fontWeight: weight.semibold, fontVariant: ["tabular-nums"] },
  code: { ...text.lg, fontWeight: weight.normal, letterSpacing: 9 },
  /** The word Mesita. */
  wordmark: { fontFamily: "Outfit", fontSize: 30, lineHeight: 34, fontWeight: "700", letterSpacing: -0.9 },
  coverWordmark: { fontFamily: "Outfit", fontSize: 24, lineHeight: 28, fontWeight: "700", letterSpacing: -0.7 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** The web's corners, by the web's names: rounded, rounded-sm … rounded-3xl,
 *  rounded-panel (a window), rounded-full. */
export const radius = { base: 4, sm: 5, md: 6, lg: 8, xl: 10, "2xl": 12, "3xl": 14, panel: 24, full: 9999 } as const;

/** The web's shadow-float (a control on the map) and shadow-elev (a lifted
 *  panel). */
export const shadow = {
  float: "0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)",
  elev: "0 25px 60px -15px rgba(0, 0, 0, 0.14)",
} as const;

/** A pressed control shrinks a touch, as the web's active:scale-[0.98]. */
export const pressedStyle = { transform: [{ scale: 0.98 }] } as const;
/** A control that is off (the web button's disabled:opacity-60). */
export const disabledOpacity = 0.6;

/** The web's ring spinner: side and ring width per size, one turn a second. */
export const spinner = { sm: { side: 16, ring: 2 }, md: { side: 24, ring: 2 }, lg: { side: 32, ring: 3 }, turnMs: 1000 } as const;

/** An icon's stroke when the caller names none. */
export const iconStroke = 1.75;

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

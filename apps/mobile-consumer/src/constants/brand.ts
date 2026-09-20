// Brand tokens + gradients, re-synced 2026-07-20 from
// apps/web-consumer/src/app/globals.css (oklch → sRGB hex for NativeWind 4 /
// Tailwind 3). Light theme only — no dark-mode / purple SaaS drift.
// If web tokens change, re-copy VALUES here in the same PR.

// BRAND-TOKENS:START (generated — do not hand-edit; run: deno task sync-brand)
export const BRAND_PINK = '#fb2b7b';
/** Pink text at body size on white — clears AA (4.77:1). BRAND_PINK does NOT (3.66:1). */
export const BRAND_PINK_TEXT = '#e10069';
export const BRAND_PINK_DEEP = '#bb0056';
/** was oklch(0.72 0.22 355) -> oklch(0.6 0.25 5); both clipped out of sRGB */
export const BRAND_GRADIENT_PINK = ['#ff65ab', '#e9006d'] as const;
/** Three-stop brand wash for full-bleed panels and tiles (auth panes, 404, badges). was --gradient-peacock, a pre-pivot name on a pink gradient; first stop clipped out of sRGB (0.24 -> ceiling 0.221) */
export const BRAND_GRADIENT = ['#ff4886', '#ed1c80', '#ed4096'] as const;
export const BRAND_PINK_RAMP = {
  50: '#fef2f4',
  100: '#fee4e9',
  200: '#ffccd6',
  300: '#ffa9bc',
  400: '#ff789d',
  500: '#fb2b7b',
  600: '#e10069',
  700: '#bb0056',
  800: '#940543',
  900: '#710b34',
  950: '#47071f',
} as const;
// BRAND-TOKENS:END

// ── THE ACHROMATIC SEMANTIC LAYER (MESITA-1954) ──────────────────────────────
//
// THE RULE: every neutral keeps its LIGHTNESS and loses its CHROMA. Chroma
// survives ONLY where a third party owns the colour, where money is at risk, or
// where a tier is named. Never on state, never on hierarchy, never on hover.
//
// COPIED VALUES, and for once literally: read off the SHIPPED
// consumer.mesita.ai stylesheet rather than re-derived from oklch, so this file
// cannot drift from web by a rounding step. The BRAND-TOKENS block above stays
// generated and stays pink; nothing below writes to it.
//
// THIS FILE IS WHERE THE REPAINT ACTUALLY LANDS ON NATIVE. React Native has no
// CSS variables, so a token change reaches only what imports COLORS — the 251
// hardcoded hex literals elsewhere in src/ had to be changed one by one.
/** Semantic palette — must stay string-equal with tailwind.config.js colors. */
export const COLORS = {
  background: '#efefef',
  foreground: '#171717',
  card: '#ffffff',
  primary: '#171717',
  primaryForeground: '#ffffff',
  secondary: '#404040',
  muted: '#efefef',
  mutedForeground: '#5d5d5d',
  accent: '#efefef',
  /** RESERVED: the one thing that says "this destroys something". */
  destructive: '#e6000f',
  /** RESERVED (MESITA-2031, merged after this file went achromatic): the
   *  Mesita Partner badge / verified rosette. Web `--partner`
   *  oklch(0.56 0.21 22) = #d41f37. A SECOND red on purpose — `destructive`
   *  means "this destroys something" and a badge meaning "this place is one
   *  of ours" must not be the colour of a delete button by accident. Keeps
   *  its chroma under the same third clause the Class metals ride: a tier
   *  the product names out loud. */
  partner: '#d41f37',
  partnerForeground: '#ffffff',
  border: '#dbdbdb',
  input: '#efefef',
  ring: '#171717',
  /** The pressed/hover step for FILLED controls. Opacity cannot do this job on
   *  ink — it fades the white LABEL with the fill, so a pressed black pill
   *  reads as greying OUT rather than lifting. */
  inkHover: '#404040',
  swipepanel: '#171717',
  swipepanelForeground: '#ffffff',
} as const;

export const GRADIENTS = {
  // THE BRAND GRADIENTS STOP REFERENCING THE GENERATED CONSTS (MESITA-1954).
  // `pink` and `brand` used to read BRAND_GRADIENT_PINK / BRAND_GRADIENT from
  // the block above so they could not drift from the brand. The brand is still
  // pink and those consts still hold it; this app is achromatic, so the two
  // deliberately part company here rather than by editing generated output.
  // A gradient whose only job is atmosphere is the first thing the rule takes.
  pink: ['#171717', '#404040'] as const,
  brand: ['#171717', '#404040'] as const,
  // Web's --gradient-premium went to an ink ramp in MESITA-1936; it was blue
  // here, which was already drift.
  premium: ['#404040', '#171717'] as const,
  // The hero wash was two soft pink blobs over a pink-white page.
  hero: ['#ffffff', '#efefef'] as const,
  shell: [COLORS.background, '#e8e8e8'] as const,
  // ── RESERVED ────────────────────────────────────────────────────────────
  // INSTAGRAM'S OWN GRADIENT. A third party owns this colour; it is the mark,
  // not decoration wearing a mark's colour. web-consumer skips
  // place-detail-links.ts and BrandLogos.tsx whole for the same reason.
  instagram: ['#f58529', '#dd2a7b', '#8134af'] as const,
  // THE CLASS LADDER, converged on web's metals. These are tiers the product
  // NAMES OUT LOUD to the guest, so they keep their hue — but they had drifted:
  // gold was #f5cc58→#eb881f against web's #906b00, and `free` was a blue-grey.
  // web-consumer pins each metal to an exclusive hue band in
  // class-palette.test.ts; mobile has no such test, which is how it drifted.
  gold: ['#b8880a', '#906b00'] as const,
  // Influencer is the LEGACY class key; web's ladder is bronze/silver/gold/
  // diamond, and this one bridges old rows (see class-context). Diamond's band.
  influencer: ['#0090c9', '#0072a0'] as const,
  /** @deprecated Use `influencer` — kept as alias for any stale imports. */
  sky: ['#0090c9', '#0072a0'] as const,
  free: ['#9a9494', '#757070'] as const,
} as const;

// 135° like the web's `linear-gradient(135deg, …)`.
export const GRADIENT_DIAGONAL = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

// --shadow-glow: pink brand glow (CTAs, active tabs)
export const SHADOW_GLOW = {
  shadowColor: COLORS.primary,
  shadowOpacity: 0.4,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

// --shadow-elev: soft dark-rose elevation (cards)
export const SHADOW_ELEV = {
  shadowColor: COLORS.foreground,
  shadowOpacity: 0.18,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
} as const;

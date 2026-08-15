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

/** Semantic palette — must stay string-equal with tailwind.config.js colors. */
export const COLORS = {
  background: '#fff7f8',
  foreground: '#260409',
  card: '#ffffff',
  primary: '#fb2b7b',
  primaryForeground: '#fffafb',
  secondary: '#cf0360',
  muted: '#faeff0',
  mutedForeground: '#775254',
  accent: '#ff6eb4',
  destructive: '#e6000c',
  border: '#ebd9db',
  input: '#f5e7e9',
  ring: '#fb2b7b',
  swipepanel: '#116bb5',
  swipepanelForeground: '#f9fcff',
} as const;

export const GRADIENTS = {
  // --gradient-pink · the primary CTA/brand surface (web class bg-pink-gradient).
  // Sourced from the generated block above so it can't drift from web.
  pink: BRAND_GRADIENT_PINK,
  // --gradient-premium (web class bg-tier-premium) — Premium = blue
  premium: ['#2563eb', '#60a5fa'] as const,
  // --gradient-hero vertical wash; use <HeroBackdrop /> for the full
  // radial-blob approximation (two soft pink blobs + this wash).
  hero: ['#fff9fa', '#f5e6e8'] as const,
  // Soft shell wash (web `from-background to-muted/30`) — end ≈ muted @ 30%.
  shell: [COLORS.background, '#fcf3f4'] as const,
  // --gradient-brand (web class bg-brand). Was `peacock`, a pre-pivot name.
  brand: BRAND_GRADIENT,
  // Instagram brand gradient (social verify + IG-connected chrome)
  instagram: ['#f58529', '#dd2a7b', '#8134af'] as const,
  gold: ['#f5cc58', '#eb881f'] as const,
  // Influencer class identity — web bg-tier-influencer (red).
  influencer: ['#ef4444', '#b91c1c'] as const,
  /** @deprecated Use `influencer` — kept as alias for any stale imports. */
  sky: ['#ef4444', '#b91c1c'] as const,
  free: ['#ced9e5', '#9ba6b1'] as const,
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
